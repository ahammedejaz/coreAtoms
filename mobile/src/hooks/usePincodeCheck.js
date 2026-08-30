/**
 * usePincodeCheck — Shared hook for checking delivery availability by pincode.
 * Used by ProductDetailScreen and CheckoutScreen.
 */
import { useRef, useState } from 'react';
import { supabase } from '../services/supabase/client';

export function usePincodeCheck({ showToast } = {}) {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const isFetching = useRef(false);

  const handlePincodeChange = (text) => {
    setPincode(text.replace(/\D/g, '').slice(0, 6));
    setResult(null); // reset on new input
  };

  const checkPincode = async (pincodeOverride) => {
    const pin = pincodeOverride || pincode;
    if (!pin || pin.length !== 6) {
      showToast?.('Enter a valid 6-digit pincode', 'warning');
      return null;
    }

    // Guard against concurrent requests
    if (isFetching.current) return null;
    isFetching.current = true;

    setChecking(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('delhivery-pincode-check', {
        body: { pincode: pin },
      });

      if (error) throw error;

      const res = data?.serviceable
        ? { available: true, message: 'Delivery available at this pincode!', data }
        : { available: false, message: 'Delivery not available at this pincode.' };

      setResult(res);
      return res;
    } catch {
      const res = { available: false, message: 'Unable to check pincode. Try again.' };
      setResult(res);
      return res;
    } finally {
      setChecking(false);
      isFetching.current = false;
    }
  };

  return {
    pincode,
    setPincode: handlePincodeChange,
    result,
    setResult,
    checking,
    checkPincode,
  };
}
