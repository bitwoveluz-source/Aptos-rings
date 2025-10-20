import axios from 'axios';

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://apricot-main-cod-964.mypinata.cloud';
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI3M2Y5MTBiYy0yN2Y5LTQ1YTYtOGY3MS0yMjNkMmNlZDQ3NzkiLCJlbWFpbCI6ImJydW5vdmVsdXoyOUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiOTQwODliYzBlZmU3ODQyZGI4YmQiLCJzY29wZWRLZXlTZWNyZXQiOiJmZWZhYzc3Yzg4NjljNTU5ZjgxOGJlNzk0ZjBkZjFiOTljYjBmNmE3ZGVkOGQ3NDBiOWI3ODllYzE3NGY1MDlkIiwiZXhwIjoxNzkxODc3NTY3fQ.SUmLuUX5APt9ZMvyE-lqIqT-KliqTp7fhNzT6f5cvHY';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const uploadToPinata = async (file: File, retryCount = 0): Promise<{ ipfsHash: string; ipfsUrl: string }> => {
  const maxRetries = 3;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${PINATA_API_URL}/pinning/pinFileToIPFS`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${JWT}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const ipfsHash = response.data.IpfsHash;
    // Use your dedicated Pinata gateway
    const ipfsUrl = `${PINATA_GATEWAY}/ipfs/${ipfsHash}`;
    return { ipfsHash, ipfsUrl };
  } catch (error: any) {
    console.error('Error uploading to Pinata:', error?.response?.data || error.message);
    
    if (error?.response?.status === 429 && retryCount < maxRetries) {
      // If rate limited, wait and retry with exponential backoff
      const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
      await delay(waitTime);
      return uploadToPinata(file, retryCount + 1);
    }

    if (error?.response?.status === 429) {
      throw new Error('Pinata rate limit exceeded. Please try again in a few minutes.');
    }

    throw new Error('Failed to upload image to IPFS: ' + (error?.response?.data?.error?.message || error.message));
  }
};

/**
 * Delete (unpin) a file from Pinata by IPFS URL or hash
 * @param ipfsUrlOrHash The IPFS gateway URL or just the hash
 */
export const deleteFromPinata = async (ipfsUrlOrHash: string): Promise<void> => {
  // Extract hash if a URL is provided
  let ipfsHash = ipfsUrlOrHash;
  if (ipfsUrlOrHash.startsWith('http')) {
    const match = ipfsUrlOrHash.match(/\/ipfs\/([A-Za-z0-9]+)/);
    if (match && match[1]) {
      ipfsHash = match[1];
    } else {
      throw new Error('Invalid IPFS URL');
    }
  }
  try {
    await axios.delete(`${PINATA_API_URL}/pinning/unpin/${ipfsHash}`, {
      headers: {
        Authorization: `Bearer ${JWT}`,
      },
    });
    // eslint-disable-next-line no-console
    console.log('Deleted from Pinata:', ipfsHash);
  } catch (error: any) {
    console.error('Error deleting from Pinata:', error?.response?.data || error.message);
    throw new Error('Failed to delete image from Pinata: ' + (error?.response?.data?.error?.message || error.message));
  }
};