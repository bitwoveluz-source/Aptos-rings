import React, { useState, useEffect } from 'react';
import RingPreview from '../components/RingPreview';
// Helper to get attribute value by trait_type from ringAttributes
export function getAttributeValue(traitType: string, ringAttributes: any[]): string {
  if (!Array.isArray(ringAttributes)) return '';
  const attr = ringAttributes.find((a: any) => a.trait_type === traitType);
  return attr ? attr.value : '';
}
import {
  Box,
  Container,
  Select,
  Input,
  Button,
  VStack,
  Heading,
  useToast,
  Flex,
  Image as ChakraImage,
  Text,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { uploadToPinata } from '../services/pinata';
import { collection, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useNavigate } from 'react-router-dom';
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { createOrGetWalletProfile, addMintedRingToProfile } from '../services/firebaseProfile';

import axios from 'axios';

// channel images removed from selector; assets kept in repo if needed later

// Helper to filter materials by type and entry
const filterMaterialsByTypeAndEntry = (materials: Material[], type: string, entry: string) => {
  return materials.filter((material: Material) => material.type === type && material.entry === entry);
};

// Helper to get inlay options
const getInlayOptions = (materials: Material[], inlayType: string, entry: string) => {
  return materials.filter((material: Material) => material.type === inlayType && material.entry === entry);
};

interface Material {
  id: string;
  name: string;
  type: string;
  entry?: string;
  imageUrl?: string;
  ipfsHash?: string;
  glbUrl?: string;  // Added for backward compatibility
  modelUrl?: string; // Added for backward compatibility
  modelIpfsHash?: string; // Added for backward compatibility
  price?: number;
};

// Helper to get image for a material type
const getMaterialImage = (type: string, name: string, materials: Material[] = [], entry?: string) => {
  if (type === 'core') {
    const coreMaterial = materials.find(m => m.type === 'core' && m.name === name && m.entry === entry);
    if (coreMaterial && coreMaterial.imageUrl) {
      return coreMaterial.imageUrl;
    }
  }
  if (type.startsWith('inlay')) {
    const inlayMaterial = materials.find(m => m.type === type && m.name === name && m.entry === entry);
    if (inlayMaterial && inlayMaterial.imageUrl) {
      return inlayMaterial.imageUrl;
    }
  }
  if (type === 'finish') {
    const finishMaterial = materials.find(m => m.type === 'finish' && m.name === name && m.entry === entry);
    if (finishMaterial && finishMaterial.imageUrl) {
      return finishMaterial.imageUrl;
    }
  }
  // Fallback placeholder
  return 'https://via.placeholder.com/350x350?text=' + encodeURIComponent(name);
};

// Helper to get 3D model for a material type
const getMaterialModel = (type: string, name: string, materials: Material[] = [], entry?: string) => {
  let material;
  if (type === 'core') {
    material = materials.find(m => m.type === 'core' && m.name === name && m.entry === entry);
  } else if (type.startsWith('inlay')) {
    material = materials.find(m => m.type === type && m.name === name && m.entry === entry);
  } else if (type === 'finish') {
    material = materials.find(m => m.type === 'finish' && m.name === name && m.entry === entry);
  }

  if (material) {
    // Try all possible URL fields in order of preference
    const modelUrl = (material.modelIpfsHash && `https://gateway.pinata.cloud/ipfs/${material.modelIpfsHash}`) ||
                    (material.ipfsHash && `https://gateway.pinata.cloud/ipfs/${material.ipfsHash}`) ||
                    material.glbUrl ||
                    material.modelUrl ||
                    '';
                  
    console.log(`[getMaterialModel] ${type} ${name}:`, {
      material,
      modelUrl,
      modelIpfsHash: material.modelIpfsHash,
      ipfsHash: material.ipfsHash,
      glbUrl: material.glbUrl,
      modelUrl: material.modelUrl
    });
    
    return modelUrl;
  } else {
    console.warn(`[getMaterialModel] No material found for ${type} ${name}`);
    return '';
  }
};

const getNextRingNumber = async (): Promise<number> => {
  const counterRef = doc(db, 'counters', 'rings');
  
  try {
    const result = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists()) {
        // Initialize counter if it doesn't exist
        transaction.set(counterRef, { count: 1 });
        return 1;
      }
      
      const newCount = (counterDoc.data().count || 0) + 1;
      transaction.update(counterRef, { count: newCount });
      return newCount;
    });

    console.log('Got next ring number:', result);
    return result;
  } catch (error) {
    console.error('Error getting next ring number:', error);
    throw error;
  }
};



const UserPage: React.FC = () => {
  const navigate = useNavigate();
  // Fetch materials from Firebase on mount
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const materialsCollection = collection(db, 'materials');
        const materialsSnapshot = await getDocs(materialsCollection);
        const materialsList = materialsSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          console.log('[Material Data]', doc.id, data);
          return {
            id: doc.id,
            name: data.name,
            type: data.type,
            entry: data.entry,
            imageUrl: data.imageUrl,
            ipfsHash: data.ipfsHash,
            glbUrl: data.glbUrl,
            modelIpfsHash: data.modelIpfsHash,
            price: data.price ? Number(data.price) : 0,
          };
        });
        console.log('[All Materials]', materialsList);
        setMaterials(materialsList);
      } catch (error) {
        console.error('Error fetching materials:', error);
        toast({
          title: 'Error',
          description: 'Failed to load materials',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };
    fetchMaterials();
  }, []);
  // Handler to capture the ring preview and open the confirmation dialog
  const handleCreateRing = async () => {
    if (!connected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your Aptos wallet first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate inlays based on channel selection
    const requiredInlays = selectedChannels === 'triple' ? 3 : selectedChannels === 'double' ? 2 : 1;
    const filledInlays = inlays.filter(inlay => inlay !== '').length;

    if (filledInlays !== requiredInlays) {
      toast({
        title: 'Error',
        description: `Please select all ${requiredInlays} inlay materials for ${selectedChannels} channel`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
  return;
    }

    // Capture the ring preview with all layers
    const ringPreviewContainer = document.querySelector('.ring-preview-container') as HTMLElement;
    if (ringPreviewContainer) {
      // Wait a moment for any ongoing animations or renders to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const html2canvas = (await import('html2canvas')).default;
      console.log('[Capture] Starting ring capture process');
      
      // Create a hidden, square, flexbox container for perfect centering
      const imageSize = 500; // Increased size for better quality
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = `${imageSize}px`;
      wrapper.style.height = `${imageSize}px`;
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.background = 'transparent';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center'; // Center ring vertically
      wrapper.style.background = '#f7fafc';
      wrapper.style.overflow = 'hidden';
      wrapper.style.borderRadius = '12px';

      // Clone the ring preview node
      const clone = ringPreviewContainer.cloneNode(true) as HTMLElement;
      // Remove any transforms or absolute positioning from the clone
      clone.style.position = 'static';
      clone.style.margin = '0';
      clone.style.left = 'unset';
      clone.style.top = 'unset';
      clone.style.transform = 'none';
      clone.style.maxWidth = '90%';
      clone.style.maxHeight = '90%';
      clone.style.width = 'auto';
      clone.style.height = 'auto';

      // Remove absolute positioning and transforms from all child images
      const images = clone.querySelectorAll('img');
      images.forEach(img => {
        img.style.position = 'static';
        img.style.top = 'unset';
        img.style.left = 'unset';
        img.style.right = 'unset';
        img.style.bottom = 'unset';
        img.style.transform = 'none';
        img.style.margin = '0 auto';
        img.style.display = 'block';
        img.style.maxWidth = '90%';
        img.style.maxHeight = '90%';
        img.style.width = 'auto';
        img.style.height = 'auto';
      });

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        backgroundColor: null,
        width: imageSize,
        height: imageSize,
        scale: 1,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImage(dataUrl);
      document.body.removeChild(wrapper);
      onOpen();
    } else {
      toast({
        title: 'Error',
        description: 'Could not find ring preview container',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCore, setSelectedCore] = useState('');
  const [selectedChannels, setSelectedChannels] = useState('single'); // default to single
  const [inlays, setInlays] = useState<string[]>(['']);
  const [engraving, setEngraving] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedFinish, setSelectedFinish] = useState('');
  const [aptPrice, setAptPrice] = useState<number>(8.25);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  useEffect(() => {
    async function updatePrice() {
      try {
        setIsLoadingPrice(true);
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd'
        );
        const data = await response.json();
        if (data.aptos?.usd) {
          setAptPrice(data.aptos.usd);
        }
      } catch (error) {
        console.error('Error fetching APT price:', error);
      } finally {
        setIsLoadingPrice(false);
      }
    }
    updatePrice();
    const interval = setInterval(updatePrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mintMessage, setMintMessage] = useState('');
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Update number of inlay inputs when channel type changes
  useEffect(() => {
    setSelectedCore('');
    setSelectedFinish('');
    if (selectedChannels === 'double') {
      setInlays(['', '']);
    } else if (selectedChannels === 'triple') {
      setInlays(['', '', '']);
    } else {
      setInlays(['']);
    }
  }, [selectedChannels]);

  const { account, signAndSubmitTransaction, connected } = useWallet();

  useEffect(() => {
    if (connected && account?.address) {
      createOrGetWalletProfile(String(account.address)).catch(console.error);
    }
  }, [connected, account]);

  const handleConfirmRing = async () => {

    setIsMinting(true);
    setMintStatus('idle');
    setMintMessage('Minting your ring NFT. Please wait...');
    try {
      // Fetch the current ring index
      const ringNumber = await getNextRingNumber();

      // Create merged GLB from selected components
      const glbFiles = [];
      
      // Add core GLB if selected
      if (selectedCore) {
        const coreUrl = getMaterialModel('core', selectedCore, materials, selectedChannels);
        if (coreUrl) {
          const coreResponse = await fetch(coreUrl);
          const coreBlob = await coreResponse.blob();
          glbFiles.push(coreBlob);
        }
      }

      // Add inlay GLBs
      for (let i = 0; i < inlays.length; i++) {
        if (inlays[i]) {
          const inlayUrl = getMaterialModel(`inlay${i + 1}`, inlays[i], materials, selectedChannels);
          if (inlayUrl) {
            const inlayResponse = await fetch(inlayUrl);
            const inlayBlob = await inlayResponse.blob();
            glbFiles.push(inlayBlob);
          }
        }
      }

      // Add finish GLB if selected
      if (selectedFinish) {
        const finishUrl = getMaterialModel('finish', selectedFinish, materials, selectedChannels);
        if (finishUrl) {
          const finishResponse = await fetch(finishUrl);
          const finishBlob = await finishResponse.blob();
          glbFiles.push(finishBlob);
        }
      }

      // Wait for all models to be loaded in RingPreview
      await new Promise(resolve => setTimeout(resolve, 2000)); // Give time for all models to render

      // Get the ring preview instance
      const ringPreviewElement = document.querySelector('.ring-preview-container');
      if (!ringPreviewElement) {
        throw new Error('Ring preview not found');
      }

      // Access the Three.js scene through a custom method we'll add
      const ringPreviewInstance = (ringPreviewElement as any).__ringPreview;
      if (!ringPreviewInstance || !ringPreviewInstance.exportScene) {
        throw new Error('Ring preview instance not properly initialized');
      }

      // Export the entire scene as GLB
      const combinedGlb = await ringPreviewInstance.exportScene();
      console.log('[Mint] Generated combined GLB:', combinedGlb);

      // Create a File object from the combined GLB
      const glbFile = new File([combinedGlb], `ring-${ringNumber}.glb`, { type: 'model/gltf-binary' });

      // For display purposes in the UI, we'll still need a preview image
      const previewUrl = URL.createObjectURL(glbFile);
      setGeneratedImage(previewUrl);

      console.log('[Mint] Uploading combined GLB file to Pinata:', glbFile);
      // Upload GLB to Pinata
      setMintMessage('Uploading 3D model to IPFS...');
      const { ipfsUrl: modelUrl } = await uploadToPinata(glbFile);
      console.log('[Mint] Received model IPFS URL:', modelUrl);

      // Create a thumbnail image for display
      const ringPreviewContainer = document.querySelector('.ring-preview') as HTMLElement;
      if (!ringPreviewContainer) {
        throw new Error('Could not find ring preview container');
      }
      const html2canvas = (await import('html2canvas')).default;
      const imageSize = 350;
      const canvas = await html2canvas(ringPreviewContainer, {
        backgroundColor: null,
        width: imageSize,
        height: imageSize,
        scale: 1,
        useCORS: true,
      });
      const thumbnailDataUrl = canvas.toDataURL('image/png');
      const thumbnailFile = await fetch(thumbnailDataUrl)
        .then(res => res.blob())
        .then(blob => new File([blob], `ring-${ringNumber}-thumbnail.png`, { type: 'image/png' }));

      console.log('[Mint] Uploading thumbnail to Pinata:', thumbnailFile);
      setMintMessage('Uploading thumbnail to IPFS...');
      const { ipfsUrl: imageUrl } = await uploadToPinata(thumbnailFile);
      console.log('[Mint] Received thumbnail IPFS URL:', imageUrl);

      // Create metadata JSON
        console.log('[Mint] Creating metadata JSON with image URL:', imageUrl);
      setMintMessage('Uploading metadata to IPFS...');
      const metadata = {
        name: `Ring #${ringNumber}`,
        description: "Aptos Rings NFT",
        image: imageUrl,
        animation_url: modelUrl, // 3D model GLB file
        attributes: [
          { trait_type: "Core", value: selectedCore },
          { trait_type: "Entry", value: selectedChannels },
          ...inlays.map((inlay, index) => ({ trait_type: `Inlay${index + 1}`, value: inlay })),
          { trait_type: "Finish", value: selectedFinish },
          { trait_type: "Edition", value: "Genesis" },
          { trait_type: "Engraving", value: engraving || "None" }
        ]
      };

      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], `ring-${ringNumber}-metadata.json`, { type: 'application/json' });
      const { ipfsUrl: metadataUrl } = await uploadToPinata(metadataFile);

      // Calculate total price in Octas
      setMintMessage('Submitting mint transaction...');
      const totals = calculateTotalPrice();
      const mintPriceOctas = Math.floor(totals.aptTotal * 100000000);

      if (!account) {
        throw new Error('Please connect your wallet first');
      }

      // Mint transaction
      await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: "0x368dc22a8a380858874b6a79c34c959f11c2d081281a69c018591ebfd952ea6c::ringminter3::mint_nft",
          functionArguments: [
            "0x368dc22a8a380858874b6a79c34c959f11c2d081281a69c018591ebfd952ea6c",
            "0x7e54056356bc04d8c96ac1aef91e5436e6aa411c03c76a7c009171459fc3a0f1",
            metadataUrl,
            mintPriceOctas
          ]
        }
      });
      setMintStatus('success');
      setMintMessage('Ring NFT minted successfully!');
      onClose();
      toast({
        title: 'Success',
        description: 'Ring NFT minted successfully!',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // After successful mint
      if (account?.address) {
        await addMintedRingToProfile(String(account.address), {
          imageIpfs: imageUrl,
          metadataIpfs: metadataUrl,
          deliveryAddress: deliveryAddress,
          status: 'in queue'
        });
      }
    } catch (error) {
      setMintStatus('error');
      setMintMessage(error instanceof Error ? error.message : 'Failed to create ring NFT');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create ring NFT',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsMinting(false);
    }
  };
  const calculateTotalPrice = (): { usdTotal: number; aptTotal: number } => {
    try {
      let totalUsd = 0; // Total in USD

      // Calculate core price
      if (selectedCore) {
        const coreMaterial = materials.find(m => m.type === 'core' && m.name === selectedCore && m.entry === selectedChannels);
        console.log('Core material:', coreMaterial);
        if (coreMaterial?.price) {
          totalUsd += Number(coreMaterial.price);
          console.log('Added core price:', coreMaterial.price, 'New total USD:', totalUsd);
        }
      }

      // Calculate inlay prices
      inlays.forEach((inlay, index) => {
        if (inlay) {
          const inlayMaterial = materials.find(m => 
            m.type === `inlay${index + 1}` && 
            m.name === inlay && 
            m.entry === selectedChannels
          );
          console.log(`Inlay ${index + 1} material:`, inlayMaterial);
          if (inlayMaterial?.price) {
            totalUsd += Number(inlayMaterial.price);
            console.log(`Added inlay ${index + 1} price:`, inlayMaterial.price, 'New total USD:', totalUsd);
          }
        }
      });

      // Calculate finish price
      if (selectedFinish) {
        const finishMaterial = materials.find(m => m.type === 'finish' && m.name === selectedFinish && m.entry === selectedChannels);
        console.log('Finish material:', finishMaterial);
        if (finishMaterial?.price) {
          totalUsd += Number(finishMaterial.price);
          console.log('Added finish price:', finishMaterial.price, 'New total USD:', totalUsd);
        }
      }

      // Convert USD total to APT
      const aptTotal = totalUsd / aptPrice;
      
      console.log('Final totals:', { totalUsd, aptTotal });
      return { 
        usdTotal: totalUsd,
        aptTotal
      };
    } catch (error) {
      console.error('Error calculating total price:', error);
      return { 
        usdTotal: 0,
        aptTotal: 0
      };
    }
  };

  const [ownedRings, setOwnedRings] = useState<any[]>([]);
  const [selectedRing, setSelectedRing] = useState<any | null>(null);
  const [ringAttributes, setRingAttributes] = useState<any[]>([]);
  const [isRingModalOpen, setIsRingModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOwnedRings() {
      if (connected && account?.address) {
        const profileRef = doc(db, 'walletProfiles', String(account.address));
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setOwnedRings(data.rings || []);
        } else {
          setOwnedRings([]);
        }
      }
    }
    fetchOwnedRings();
  }, [connected, account]);

  const handleRingClick = async (ring: any) => {
    try {
      const res = await axios.get(ring.metadataIpfs);
      setRingAttributes(res.data.attributes || []);
      setSelectedRing(ring);
      setIsRingModalOpen(true);
    } catch (err) {
      console.error('Error fetching ring metadata:', err);
      toast({
        title: 'Error',
        description: 'Failed to load ring details',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setRingAttributes([]);
    }
  };
  const handleCloseRingModal = () => {
    setIsRingModalOpen(false);
    setSelectedRing(null);
    setRingAttributes([]);
  };



  return (
    <Container maxW="container.xl" py={10}>
      <Flex mb={{ base: 8, md: 4 }} justify="space-between" align="center">
        <Box>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={() => navigate('/GalleryPage')}
            mb={{ base: 8, md: 8 }} // increased space below Gallery button
          >
            View Gallery
          </Button>
        </Box>
        <Box textAlign="right" mb={{ base: 8, md: 8 }}>
          <WalletSelector />
        </Box>
      </Flex>
      <Flex
        align="center"
        justify="center"
        minH="80vh"
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 8, md: 0 }}
      >
        {/* Left: 3D Ring Preview */}
        <Box
          flex="1"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mb={{ base: 8, md: 0 }}
          className="ring-preview"
        >
          <RingPreview
            coreUrl={selectedCore ? getMaterialModel('core', selectedCore, materials, selectedChannels) : undefined}
            inlayUrls={inlays.map((inlay, idx) => 
              inlay ? getMaterialModel(`inlay${idx + 1}`, inlay, materials, selectedChannels) : ''
            ).filter(Boolean)}
            finishUrl={selectedFinish ? getMaterialModel('finish', selectedFinish, materials, selectedChannels) : undefined}
            width={350}
            height={350}
          />
        </Box>
        {/* Right: Form */}
        <Box
          flex="1"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="100%"
        >
          <VStack spacing={6} align="stretch" w="100%" maxW="400px">
            <Heading textAlign="center" mb={4} fontSize={{ base: 'xl', md: '2xl' }}>
              Build Your Ring
            </Heading>

            <Select
              placeholder="Select Core Material"
              value={selectedCore}
              onChange={(e) => setSelectedCore(e.target.value)}
              fontSize={{ base: 'sm', md: 'md' }}
              bg="#222"
              color="#e2e8f0"
              _placeholder={{ color: '#a0aec0' }}
              borderColor="#444"
              sx={{ option: { background: '#222', color: '#e2e8f0' } }}
            >
              {filterMaterialsByTypeAndEntry(materials, 'core', selectedChannels).map(material => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </Select>

            {/* Channel selection with images */}
            <Flex gap={4} justify="center" align="center">
              <Box
                as="button"
                border={selectedChannels === 'single' ? '2px solid #3182ce' : '2px solid transparent'}
                borderRadius="md"
                p={1}
                bg={selectedChannels === 'single' ? 'blue.50' : 'transparent'}
                onClick={() => setSelectedChannels('single')}
                _hover={{ border: '2px solid #3182ce', bg: 'blue.50' }}
              >
                <Text fontSize="sm" textAlign="center">Single</Text>
              </Box>
              <Box
                as="button"
                border={selectedChannels === 'double' ? '2px solid #3182ce' : '2px solid transparent'}
                borderRadius="md"
                p={1}
                bg={selectedChannels === 'double' ? 'blue.50' : 'transparent'}
                onClick={() => setSelectedChannels('double')}
                _hover={{ border: '2px solid #3182ce', bg: 'blue.50' }}
              >
                <Text fontSize="sm" textAlign="center">Double</Text>
              </Box>
              <Box
                as="button"
                border={selectedChannels === 'triple' ? '2px solid #3182ce' : '2px solid transparent'}
                borderRadius="md"
                p={1}
                bg={selectedChannels === 'triple' ? 'blue.50' : 'transparent'}
                onClick={() => setSelectedChannels('triple')}
                _hover={{ border: '2px solid #3182ce', bg: 'blue.50' }}
              >
                <Text fontSize="sm" textAlign="center">Triple</Text>
              </Box>
            </Flex>

            {/* Inlay 1 Dropdown */}
            <Box>
              <Select
                placeholder="Select Inlay 1"
                value={inlays[0] || ''}
                onChange={(e) => {
                  const newInlays = [...inlays];
                  newInlays[0] = e.target.value;
                  setInlays(newInlays);
                }}
                fontSize={{ base: 'sm', md: 'md' }}
                bg="#222"
                color="#e2e8f0"
                _placeholder={{ color: '#a0aec0' }}
                borderColor="#444"
                sx={{ option: { background: '#222', color: '#e2e8f0' } }}
              >
                {getInlayOptions(materials, 'inlay1', selectedChannels).map(material => (
                  <option key={material.id} value={material.name}>
                    {material.name} ({material.entry})
                  </option>
                ))}
              </Select>
            </Box>
            {/* Inlay 2 Dropdown (only for double/triple) */}
            {(selectedChannels === 'double' || selectedChannels === 'triple') && (
              <Box>
                <Select
                  placeholder="Select Inlay 2"
                  value={inlays[1] || ''}
                  onChange={(e) => {
                    const newInlays = [...inlays];
                    newInlays[1] = e.target.value;
                    setInlays(newInlays);
                  }}
                  fontSize={{ base: 'sm', md: 'md' }}
                  bg="#222"
                  color="#e2e8f0"
                  _placeholder={{ color: '#a0aec0' }}
                  borderColor="#444"
                  sx={{ option: { background: '#222', color: '#e2e8f0' } }}
                >
                  {getInlayOptions(materials, 'inlay2', selectedChannels).map(material => (
                    <option key={material.id} value={material.name}>
                      {material.name} ({material.entry})
                    </option>
                  ))}
                </Select>
              </Box>
            )}
            {/* Inlay 3 Dropdown (only for triple) */}
            {selectedChannels === 'triple' && (
              <Box>
                <Select
                  placeholder="Select Inlay 3"
                  value={inlays[2] || ''}
                  onChange={(e) => {
                    const newInlays = [...inlays];
                    newInlays[2] = e.target.value;
                    setInlays(newInlays);
                  }}
                  fontSize={{ base: 'sm', md: 'md' }}
                  bg="#222"
                  color="#e2e8f0"
                  _placeholder={{ color: '#a0aec0' }}
                  borderColor="#444"
                  sx={{ option: { background: '#222', color: '#e2e8f0' } }}
                >
                  {getInlayOptions(materials, 'inlay3', selectedChannels).map(material => (
                    <option key={material.id} value={material.name}>
                      {material.name} ({material.entry})
                    </option>
                  ))}
                </Select>
              </Box>
            )}

            <Input
              placeholder="Enter Engraving Text"
              value={engraving}
              onChange={(e) => setEngraving(e.target.value)}
              fontSize={{ base: 'sm', md: 'md' }}
              color="#fff"
            />

            <Select
              placeholder="Select Finish"
              value={selectedFinish}
              onChange={(e) => setSelectedFinish(e.target.value)}
              fontSize={{ base: 'sm', md: 'md' }}
              bg="#222"
              color="#e2e8f0"
              _placeholder={{ color: '#a0aec0' }}
              borderColor="#444"
              sx={{ option: { background: '#222', color: '#e2e8f0' } }}
            >
              {filterMaterialsByTypeAndEntry(materials, 'finish', selectedChannels).map(material => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </Select>

            {/* Delivery Address Input - moved here */}
            <Box>
              <Input
                placeholder="Enter your delivery address"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                fontSize={{ base: 'sm', md: 'md' }}
                color="rgba(255, 255, 255, 1)"
              />
            </Box>

            <Box textAlign="center" mb={4}>
              {(() => {
                const totals = calculateTotalPrice();
                return (
                  <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="bold" color="blue.600">
                    Total Mint Cost: ${totals.usdTotal.toFixed(2)} ({totals.aptTotal.toFixed(2)} APT)
                  </Text>
                );
              })()}
              {process.env.NODE_ENV === 'development' && (
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Selected: {[selectedCore, ...inlays, selectedFinish].filter(Boolean).join(', ')}
                </Text>
              )}
            </Box>


            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleCreateRing}
              fontSize={{ base: 'sm', md: 'md' }}
              isDisabled={isMinting}
            >
              Create Ring
            </Button>
            {/* Minting Loading Modal */}
            <AlertDialog isOpen={isMinting} leastDestructiveRef={cancelRef} onClose={() => {}} isCentered>
              <AlertDialogOverlay bg="blackAlpha.400" backdropFilter="blur(6px)" />
              <AlertDialogContent maxW="sm" textAlign="center" py={8}>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  {mintStatus === 'idle' && 'Minting...'}
                  {mintStatus === 'success' && 'Success!'}
                  {mintStatus === 'error' && 'Error'}
                </AlertDialogHeader>
                <AlertDialogBody>
                  <Text mb={4}>{mintMessage}</Text>
                  {mintStatus === 'idle' && (
                    <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="24" cy="24" r="20" stroke="#3182ce" strokeWidth="4" opacity="0.2" />
                        <path d="M44 24c0-11.046-8.954-20-20-20" stroke="#3182ce" strokeWidth="4" strokeLinecap="round">
                          <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1s" repeatCount="indefinite" />
                        </path>
                      </svg>
                    </Box>
                  )}
                  {mintStatus === 'success' && (
                    <Box color="green.400" fontSize="4xl" py={4}>✔️</Box>
                  )}
                  {mintStatus === 'error' && (
                    <Box color="red.400" fontSize="4xl" py={4}>❌</Box>
                  )}
                </AlertDialogBody>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              isOpen={isOpen}
              leastDestructiveRef={cancelRef}
              onClose={onClose}
              isCentered
            >
              <AlertDialogOverlay 
                bg="blackAlpha.300"
                backdropFilter="blur(10px)"
                zIndex={1400}
              >
                <AlertDialogContent
                  zIndex={1500}
                  mx={4}
                  maxW="xl"
                >
                  <AlertDialogHeader fontSize="lg" fontWeight="bold">
                    Are you happy with this ring?
                  </AlertDialogHeader>

                  <AlertDialogBody>
                    Take one last look at your creation. Would you like to proceed with minting this ring as an NFT?
                    {(() => {
                      const totals = calculateTotalPrice();
                      return (
                        <>
                          <Text mt={4} fontWeight="bold" fontSize="lg" color="blue.500">
                            Total Mint Cost: ${totals.usdTotal.toFixed(2)} ({totals.aptTotal.toFixed(2)} APT)
                          </Text>
                          <Text fontSize="sm" color="gray.500" mt={1}>
                            Current APT Price: ${aptPrice.toFixed(2)} USD
                          </Text>
                        </>
                      );
                    })()}
                    <Box 
                      position="relative"
                      width={{ base: "220px", md: "350px" }}
                      height={{ base: "220px", md: "350px" }}
                      mx="auto"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bg="transparent"
                      borderRadius="md"
                      overflow="hidden"
                    >
                      <RingPreview
                        coreUrl={selectedCore ? getMaterialModel('core', selectedCore, materials, selectedChannels) : undefined}
                        inlayUrls={inlays.map((inlay, idx) => 
                          inlay ? getMaterialModel(`inlay${idx + 1}`, inlay, materials, selectedChannels) : ''
                        ).filter(Boolean)}
                        finishUrl={selectedFinish ? getMaterialModel('finish', selectedFinish, materials, selectedChannels) : undefined}
                        width={350}
                        height={350}
                      />
                    </Box>
                  </AlertDialogBody>

                  <AlertDialogFooter>
                    <Button 
                      ref={cancelRef} 
                      onClick={onClose}
                      variant="ghost"
                      color="gray.600"
                      _hover={{ bg: 'gray.100' }}
                      zIndex={1600}
                    >
                      No, I want to make changes
                    </Button>
                    <Button 
                      bg="#63B3ED"
                      color="white"
                      onClick={handleConfirmRing} 
                      ml={3} 
                      _hover={{ bg: '#4299E1' }}
                      zIndex={1600}
                    >
                      Yes, mint this ring!
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialogOverlay>
            </AlertDialog>

            <Box mt={10} mb={4} textAlign="center">
              <Heading size="md" mb={2}>Your Rings</Heading>
              <Flex justify="center" gap={4} wrap="wrap">
                {ownedRings.length === 0 ? (
                  <Text color="gray.500">No rings minted yet.</Text>
                ) : (
                  ownedRings.map((ring, idx) => (
                    <Box key={idx} border="2px solid #CBD5E0" borderRadius="md" p={2} minW="80px" minH="80px" display="flex" alignItems="center" justifyContent="center" bg="white" cursor="pointer" onClick={() => handleRingClick(ring)}>
                      <ChakraImage src={ring.imageIpfs} alt={`Ring ${idx + 1}`} boxSize="60px" objectFit="contain" />
                    </Box>
                  ))
                )}
              </Flex>
            </Box>
            {/* Ring Details Modal */}
            <AlertDialog isOpen={isRingModalOpen} onClose={handleCloseRingModal} isCentered leastDestructiveRef={cancelRef}>
              <AlertDialogOverlay />
              <AlertDialogContent maxW="sm" textAlign="center" py={8} bg="rgba(255,255,255,0.85)">
                <AlertDialogHeader fontSize="lg" fontWeight="bold" color="#222">Ring Details</AlertDialogHeader>
                <AlertDialogBody color="#222">
                  {selectedRing && (
                    <>
                      <Box display="flex" justifyContent="center" alignItems="center" mb={6}>
                        <ChakraImage src={selectedRing.imageIpfs} alt="Ring" boxSize="170px" objectFit="contain" borderRadius="12px" boxShadow="md" bg="gray.50" />
                      </Box>
                      {/* Main attributes in bordered box */}
                      <Box border="1px solid #CBD5E0" borderRadius="10px" p={4} mb={3} display="inline-block" minW="240px" boxShadow="sm" bg="white">
                        <Flex justify="space-between" mb={2} gap={4}>
                          <Text fontSize="md" color="#222"><b>Core:</b> {getAttributeValue('Core', ringAttributes)}</Text>
                          <Text fontSize="md" color="#222"><b>Finish:</b> {getAttributeValue('Finish', ringAttributes)}</Text>
                        </Flex>
                        <Flex justify="space-between" mb={2} gap={4}>
                          <Text fontSize="md" color="#222"><b>Entry:</b> {getAttributeValue('Entry', ringAttributes)}</Text>
                          <Text fontSize="md" color="#222"><b>Edition:</b> {getAttributeValue('Edition', ringAttributes)}</Text>
                        </Flex>
                        <Text fontSize="md" mb={2} color="#222"><b>Inlay1:</b> {getAttributeValue('Inlay1', ringAttributes)}</Text>
                      </Box>
                      {/* Engraving in its own box */}
                      <Box border="1px solid #CBD5E0" borderRadius="10px" p={3} mb={3} display="inline-block" minW="240px" boxShadow="sm" bg="white">
                        <Text fontSize="md" color="#222"><b>Engraving:</b> {getAttributeValue('Engraving', ringAttributes)}</Text>
                      </Box>
                      {/* Delivery Address and Status as bold labels at the bottom */}
                      <Box mt={3}>
                        {selectedRing.deliveryAddress && (
                          <Text fontSize="md" fontWeight="bold" mb={2} color="#222">
                            Delivery Address: <span style={{fontWeight: 'normal'}}>{selectedRing.deliveryAddress}</span>
                          </Text>
                        )}
                        {selectedRing.status && (
                          <Text fontSize="md" fontWeight="bold" mb={2} color="#222">
                            Status: <span style={{fontWeight: 'normal'}}>{selectedRing.status}</span>
                          </Text>
                        )}
                      </Box>
                    </>
                  )}
                </AlertDialogBody>
                <AlertDialogFooter>
                  <Button onClick={handleCloseRingModal} colorScheme="blue">Close</Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </VStack>
        </Box>
      </Flex>
    </Container>
  );
};

export default UserPage;