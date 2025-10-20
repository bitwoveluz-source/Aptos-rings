import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

/**
 * Creates a Firebase profile for a unique Aptos wallet address if it doesn't exist.
 * @param walletAddress The Aptos wallet address (string)
 * @param profileData Optional profile data to store (object)
 */
export async function createOrGetWalletProfile(walletAddress: string, profileData: Record<string, any> = {}) {
  console.log('[FirebaseProfile] Called with address:', walletAddress);
  if (!walletAddress) throw new Error('Wallet address is required');
  const profileRef = doc(db, 'walletProfiles', walletAddress);
  try {
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      console.log('[FirebaseProfile] Profile exists:', profileSnap.data());
      return profileSnap.data();
    } else {
      await setDoc(profileRef, {
        walletAddress,
        createdAt: new Date().toISOString(),
        ...profileData,
      });
      console.log('[FirebaseProfile] Profile created:', { walletAddress, createdAt: new Date().toISOString(), ...profileData });
      return { walletAddress, createdAt: new Date().toISOString(), ...profileData };
    }
  } catch (error) {
    console.error('[FirebaseProfile] Error:', error);
    throw error;
  }
}

/**
/**
 * Adds a minted ring's IPFS data to the wallet profile.
 * @param walletAddress The Aptos wallet address (string)
 * @param ringData { imageIpfs: string, metadataIpfs: string, deliveryAddress?: string }
 */
export async function addMintedRingToProfile(walletAddress: string, ringData: { imageIpfs: string, metadataIpfs: string, deliveryAddress?: string, status?: string }) {
  if (!walletAddress) throw new Error('Wallet address is required');
  const profileRef = doc(db, 'walletProfiles', walletAddress);
  try {
    await updateDoc(profileRef, {
      rings: arrayUnion(ringData)
    });
    console.log('[FirebaseProfile] Added ring to profile:', walletAddress, ringData);
  } catch (error) {
    console.error('[FirebaseProfile] Error adding ring:', error);
    throw error;
  }
}
