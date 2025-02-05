import React, { useState, useEffect } from 'react';
import { Text, Input, Stack, Checkbox, Button, hubspot } from '@hubspot/ui-extensions';

hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
    fetchProperties={actions.fetchCrmObjectProperties}
    updateProperties={actions.refreshObjectProperties}
  />
));

const Extension = ({ context, sendAlert, fetchProperties, updateProperties }) => {
  const [dealId, setDealId] = useState(context?.crm?.objectId || '');
  const [stripepaymentintentid, setPaymentIntent] = useState('');
  const [refundamount, setRefundAmount] = useState('');
  const [error, setError] = useState(null);
  const [submit_refund_status, setSubmitRefund] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hubspot) {
      setError('HubSpot SDK is not initialized correctly.');
      return;
    }

    if (!context?.crm?.objectId) {
      setError('No Deal ID available. Please check the app embedding.');
      return;
    }

    fetchProperties(['stripepaymentintentid', 'refundamount'])
      .then((properties) => {
        setPaymentIntent(properties?.stripepaymentintentid || '');
        setRefundAmount(properties?.refundamount || '');
      })
      .catch((err) => {
        setError('Failed to fetch deal properties.');
      });
  }, [context, fetchProperties]);

  const handleRefundAmountChange = (event) => {
    if (event && event.target) {
      setRefundAmount(event.target.value);
    }
  };

  const saveRefundAmount = async () => {
    setLoading(true);
    try {
      await updateProperties({
        refundamount: refundamount, // Update HubSpot property
      });
      sendAlert({ type: 'success', message: 'Refund amount updated successfully!' });
    } catch (err) {
      sendAlert({ type: 'danger', message: 'Failed to update refund amount. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = () => {
    const newValue = !submit_refund_status;
    setSubmitRefund(newValue);

    if (newValue) {
      sendAlert({ type: 'success', message: 'Refund submission initiated.' });
    } else {
      sendAlert({ type: 'info', message: 'Refund submission cancelled.' });
    }
  };

  return (
    <Stack>
      <Text format={{ fontWeight: 'bold', fontSize: '20px' }}>
        HubSpot Deal Information
      </Text>
      {error ? (
        <Text color="red">{error}</Text>
      ) : (
        <>
          <Text>Deal ID: {dealId}</Text>
          <Text>Stripe Payment Intent ID: {stripepaymentintentid}</Text>

          <Text>Refund Amount:</Text>
          <Input
            value={refundamount}
            onChange={handleRefundAmountChange}
            type="number"
          />
          <Button onClick={saveRefundAmount} disabled={loading}>
            Save Refund Amount
          </Button>
        </>
      )}

      <Text format={{ fontWeight: 'bold', fontSize: '20px' }}>
        Submit Refund? (Yes/No)
      </Text>
      <Checkbox
        name="submit_refund_status"
        label="Submit Refund (Yes/No)"
        checked={submit_refund_status}
        onChange={handleCheckboxChange}
      />
      <Text>
        Selected Option: {submit_refund_status ? 'Yes' : 'No'}
      </Text>
    </Stack>
  );
};

export default Extension;
