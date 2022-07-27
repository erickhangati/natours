/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe(
  'pk_test_51LOHBLHi7CwhwoFLJHeVEPd5M1q39XQlsKF7EmeIyds7GkaDwLAVVTka1KWqj1vFwwOWh8Ywfi6eMoSaK9Y3jBm000HazB8Wj1'
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from api
    const session = await axios({
      method: 'GET',
      url: `/api/v1/bookings/checkout-session/${tourId}`,
    });

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
