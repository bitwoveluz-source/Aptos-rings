import React, { useState, useEffect } from 'react';
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
import { collection, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";

// @ts-ignore
import singleChannelImg from '../images/single.png';
// @ts-ignore
import doubleChannelImg from '../images/double.png';
// @ts-ignore
import tripleChannelImg from '../images/triple.png';

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
  // Fetch materials from Firebase on mount
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const materialsCollection = collection(db, 'materials');
        const materialsSnapshot = await getDocs(materialsCollection);
        const materialsList = materialsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            type: data.type,
            entry: data.entry,
            imageUrl: data.imageUrl,
            ipfsHash: data.ipfsHash,
            price: data.price ? Number(data.price) : 0,
          };
        });
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

    // Capture the actual .ring-preview DOM node so the dialog shows the full-color ring
    const ringPreviewContainer = document.querySelector('.ring-preview') as HTMLElement;
    if (ringPreviewContainer) {
      const html2canvas = (await import('html2canvas')).default;
      // Create a hidden, square, flexbox container for perfect centering
      const imageSize = 350; // px, adjust as needed
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = `${imageSize}px`;
      wrapper.style.height = `${imageSize}px`;
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
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

  const { account, signAndSubmitTransaction } = useWallet();

  const handleConfirmRing = async () => {

    setIsMinting(true);
    setMintStatus('idle');
    setMintMessage('Minting your ring NFT. Please wait...');
    try {
      // Always recapture the ring preview image
      const ringPreviewContainer = document.querySelector('.ring-preview') as HTMLElement;
      if (!ringPreviewContainer) {
        throw new Error('Could not find ring preview container');
      }
      // Fetch the current ring index before generating the background and for all uses
      const ringNumber = await getNextRingNumber();
      const html2canvas = (await import('html2canvas')).default;
      const imageSize = 350;
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = `${imageSize}px`;
      wrapper.style.height = `${imageSize}px`;
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      // Shift hue for each ring number, keep background very pale
      const hue = (ringNumber * 37) % 360; // 37 is arbitrary for visible shift
      wrapper.style.background = `hsl(${hue}, 60%, 98%)`;
      wrapper.style.overflow = 'hidden';
      wrapper.style.borderRadius = '12px';
      const clone = ringPreviewContainer.cloneNode(true) as HTMLElement;
      clone.style.position = 'static';
      clone.style.margin = '0';
      clone.style.left = 'unset';
      clone.style.top = 'unset';
      clone.style.transform = 'none';
      clone.style.maxWidth = '90%';
      clone.style.maxHeight = '90%';
      clone.style.width = 'auto';
      clone.style.height = 'auto';
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
      // Force uniqueness: set a single pixel to a random color (invisible to user)
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const x = imageSize - 1;
        const y = imageSize - 1;
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        ctx.fillStyle = `rgba(${r},${g},${b},0.01)`; // almost invisible
        ctx.fillRect(x, y, 1, 1);
      }
      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImage(dataUrl);
      document.body.removeChild(wrapper);

      // Convert base64 image to file, using the indexed ring number for the filename
      const imageFile = await fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => new File([blob], `ring-${ringNumber}.png`, { type: 'image/png' }));

        console.log('[Mint] Uploading image file to Pinata:', imageFile);
      // Upload image to Pinata
      setMintMessage('Uploading image to IPFS...');
        const { ipfsUrl: imageUrl } = await uploadToPinata(imageFile);
        console.log('[Mint] Received image IPFS URL:', imageUrl);

      // Create metadata JSON
        console.log('[Mint] Creating metadata JSON with image URL:', imageUrl);
      setMintMessage('Uploading metadata to IPFS...');
      const metadata = {
        name: `Ring #${ringNumber}`,
        description: "Aptos Rings NFT",
        image: imageUrl,
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

  const { connected } = useWallet();

  return (
    <Container maxW="container.xl" py={10}>
      <Box mb={4} textAlign="right">
        <WalletSelector />
      </Box>
      <Flex
        align="center"
        justify="center"
        minH="80vh"
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 8, md: 0 }}
      >
        {/* Left: Layered Ring Illustration */}
        <Box
          flex="1"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mb={{ base: 8, md: 0 }}
          position="relative"
          minH={{ base: '220px', md: '350px' }}
          className="ring-preview"
          sx={{
            '& > img': {
              position: 'absolute !important',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }
          }}
        >
          {/* Channel image (always present) */}
          <ChakraImage
            src={
              selectedChannels === 'single' ? singleChannelImg :
              selectedChannels === 'double' ? doubleChannelImg :
              selectedChannels === 'triple' ? tripleChannelImg : singleChannelImg
            }
            alt="Channel"
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            m="auto"
            maxW={{ base: '220px', md: '350px' }}
            maxH={{ base: '220px', md: '350px' }}
            zIndex={1}
          />
          {/* Core image */}
          {selectedCore && (
            <ChakraImage
              src={getMaterialImage('core', selectedCore, materials, selectedChannels)}
              alt={selectedCore}
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              m="auto"
              maxW={{ base: '220px', md: '350px' }}
              maxH={{ base: '220px', md: '350px' }}
              zIndex={2}
              opacity={0.85}
            />
          )}
          {/* Inlay images */}
          {inlays.map((inlay, idx) => {
            const inlayType = `inlay${idx + 1}`;
            return inlay ? (
              <ChakraImage
                key={idx}
                src={getMaterialImage(inlayType, inlay, materials, selectedChannels)}
                alt={`Inlay ${idx + 1}: ${inlay}`}
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                m="auto"
                maxW={{ base: '220px', md: '350px' }}
                maxH={{ base: '220px', md: '350px' }}
                zIndex={3 + idx}
                opacity={0.7}
                data-inlay={inlayType}
              />
            ) : null;
          })}
          {/* Finish image */}
          {selectedFinish && (
            <ChakraImage
              src={getMaterialImage('finish', selectedFinish, materials, selectedChannels)}
              alt={selectedFinish}
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              m="auto"
              maxW={{ base: '220px', md: '350px' }}
              maxH={{ base: '220px', md: '350px' }}
              zIndex={10}
              opacity={0.5}
            />
          )}
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
              Create Your Ring NFT
            </Heading>

            <Select
              placeholder="Select Core Material"
              value={selectedCore}
              onChange={(e) => setSelectedCore(e.target.value)}
              fontSize={{ base: 'sm', md: 'md' }}
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
                <ChakraImage src={singleChannelImg} alt="Single Channel" boxSize="60px" objectFit="contain" />
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
                <ChakraImage src={doubleChannelImg} alt="Double Channel" boxSize="60px" objectFit="contain" />
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
                <ChakraImage src={tripleChannelImg} alt="Triple Channel" boxSize="60px" objectFit="contain" />
                <Text fontSize="sm" textAlign="center">Triple</Text>
              </Box>
            </Flex>

            {/* Inlay 1 Dropdown */}
            <Box>
              <Text fontSize="sm" mb={1}>Inlay 1</Text>
              <Select
                placeholder="Select Inlay 1"
                value={inlays[0] || ''}
                onChange={(e) => {
                  const newInlays = [...inlays];
                  newInlays[0] = e.target.value;
                  setInlays(newInlays);
                }}
                fontSize={{ base: 'sm', md: 'md' }}
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
                <Text fontSize="sm" mb={1}>Inlay 2</Text>
                <Select
                  placeholder="Select Inlay 2"
                  value={inlays[1] || ''}
                  onChange={(e) => {
                    const newInlays = [...inlays];
                    newInlays[1] = e.target.value;
                    setInlays(newInlays);
                  }}
                  fontSize={{ base: 'sm', md: 'md' }}
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
                <Text fontSize="sm" mb={1}>Inlay 3</Text>
                <Select
                  placeholder="Select Inlay 3"
                  value={inlays[2] || ''}
                  onChange={(e) => {
                    const newInlays = [...inlays];
                    newInlays[2] = e.target.value;
                    setInlays(newInlays);
                  }}
                  fontSize={{ base: 'sm', md: 'md' }}
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
            />

            <Select
              placeholder="Select Finish"
              value={selectedFinish}
              onChange={(e) => setSelectedFinish(e.target.value)}
              fontSize={{ base: 'sm', md: 'md' }}
            >
              {filterMaterialsByTypeAndEntry(materials, 'finish', selectedChannels).map(material => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </Select>

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
                    {generatedImage && (
                      <Box 
                        position="relative"
                        width={{ base: "220px", md: "350px" }}
                        height={{ base: "220px", md: "350px" }}
                        mx="auto"
                        display="flex"
                        alignItems="center" // Center image vertically
                        justifyContent="center"
                        bg="gray.50"
                        borderRadius="md"
                        overflow="hidden"
                      >
                        <ChakraImage 
                          src={generatedImage} 
                          alt="Generated Ring" 
                          maxW={{ base: "220px", md: "350px" }}
                          maxH={{ base: "220px", md: "350px" }}
                          objectFit="contain"
                          mb={4} // Add margin-bottom to nudge image lower
                          sx={{
                            imageRendering: "high-quality"
                          }}
                        />
                      </Box>
                    )}
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
          </VStack>
        </Box>
      </Flex>
    </Container>
  );
};

export default UserPage;