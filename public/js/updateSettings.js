/* eslint-disable */

import axios from 'axios';
import { showAlert } from './alerts';

export const updateSettings = async (data, type) => {
  try {
    const urlEnd = type === 'data' ? 'update-me' : 'update-password';
    const res = await axios({
      method: 'PATCH',
      url: `/api/v1/users/${urlEnd}`,
      data,
    });

    if (res.data.status === 'success') {
      showAlert(
        'success',
        `${type === 'data' ? 'Data' : 'Password'} updated successfully.`
      );
      window.setTimeout(() => {
        location.reload(true);
      }, 2000);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
