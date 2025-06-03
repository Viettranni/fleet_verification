import axios from 'axios';

const API_TOKEN = process.env.NEXT_PUBLIC_PLATE_TOKEN;

const API_URL = 'https://api.platerecognizer.com/v1/plate-reader/';

export const recognizePlate = async (imageFile: File): Promise<string | null> => {
  const formData = new FormData();
  formData.append('upload', imageFile);

  try {
    console.log("Whaaasfjwbkdjbcjd" + process.env.NEXT_PUBLIC_PLATE_TOKEN);
    const response = await axios.post(API_URL, formData, {
      headers: {
        Authorization: `Token ${API_TOKEN}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    const results = response.data.results;
    if (results && results.length > 0) {
      return results[0].plate.toUpperCase();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error recognizing plate:', error);
    return null;
  }
};
