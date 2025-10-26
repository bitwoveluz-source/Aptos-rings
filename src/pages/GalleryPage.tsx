import React, { useEffect, useState } from 'react';
import { Box, Heading, SimpleGrid, Image, Text, Spinner, IconButton, 
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, 
  useDisclosure, VStack, Link, Button, HStack, Divider } from '@chakra-ui/react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import RingPreview from '../components/RingPreview';
import { QRCodeSVG } from 'qrcode.react';
import { ViewIcon } from '@chakra-ui/icons';
import { FaAndroid, FaApple } from 'react-icons/fa';
import axios from 'axios';

interface Ring {
  metadataIpfs?: string;
  imageIpfs?: string;
  usdzUrl?: string; // URL for iOS USDZ file
  status?: string;
  attributes?: any[];
  animation_url?: string;
  [key: string]: any;
}

// Helper function to fetch and process metadata
const fetchRingMetadata = async (metadataIpfs: string) => {
  try {
    const metadataUrl = metadataIpfs.startsWith('ipfs://')
      ? metadataIpfs.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
      : metadataIpfs;
    
    console.log('Fetching metadata from:', metadataUrl);
    const response = await axios.get(metadataUrl);
    const metadata = response.data;
    
    // Convert animation_url if it exists
    if (metadata.animation_url) {
      metadata.animation_url = metadata.animation_url.startsWith('ipfs://')
        ? metadata.animation_url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
        : metadata.animation_url;
      console.log('Found GLB model URL:', metadata.animation_url);
    }
    
    return metadata;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
};

interface RingProfile {
  id: string;
  walletAddress?: string;
  rings?: Ring[];
}

// AR QR Code Modal Component
const ARQRCodeModal = ({ isOpen, onClose, modelUrl }: { 
  isOpen: boolean; 
  onClose: () => void; 
  modelUrl: string; 
}) => {
  // Create AR viewer URLs for both platforms
  const baseUrl = window.location.origin;
  
  // For Android, we use the GLB file in the AR viewer
  const androidUrl = `${baseUrl}/ar-viewer.html?model=${encodeURIComponent(modelUrl)}`;
  
  // For iOS, we need both GLB and USDZ for fallback
  const usdzUrl = modelUrl.replace('.glb', '.usdz');
  const iosUrl = `${baseUrl}/ar-viewer.html?model=${encodeURIComponent(modelUrl)}&ios-model=${encodeURIComponent(usdzUrl)}#allowsContentScaling=0`;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader textAlign="center">View Ring in AR</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} py={4}>
            <HStack spacing={8} align="flex-start">
              {/* Android QR Code */}
              <VStack spacing={3}>
                <Box p={4} borderWidth={1} borderRadius="lg" borderColor="gray.200">
                  <QRCodeSVG
                    value={androidUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </Box>
                <HStack>
                  <FaAndroid size="20px" />
                  <Text fontSize="sm" fontWeight="bold">Android</Text>
                </HStack>
                <Link href={androidUrl} isExternal color="blue.500" fontSize="sm">
                  Open in Android
                </Link>
              </VStack>

              {/* iOS QR Code */}
              <VStack spacing={3}>
                <Box p={4} borderWidth={1} borderRadius="lg" borderColor="gray.200">
                  <QRCodeSVG
                    value={iosUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </Box>
                <HStack>
                  <FaApple size="20px" />
                  <Text fontSize="sm" fontWeight="bold">iPhone</Text>
                </HStack>
                <Link href={iosUrl} isExternal color="blue.500" fontSize="sm">
                  Open in iPhone
                </Link>
              </VStack>
            </HStack>

            <Divider />

            <VStack spacing={2}>
              <Text fontSize="sm" color="gray.600" textAlign="center" fontWeight="medium">
                How to view in AR:
              </Text>
              <VStack spacing={1} fontSize="sm" color="gray.600" align="start" w="full" pl={4}>
                <Text>1. Scan the QR code for your device</Text>
                <Text>2. Android: Tap the AR button (cube icon)</Text>
                <Text>3. iPhone: Tap "AR Quick Look"</Text>
                <Text>4. Follow on-screen prompts to place the ring</Text>
              </VStack>
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const GalleryPage: React.FC = () => {
  const navigate = (window as any).navigate || undefined;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedModelUrl, setSelectedModelUrl] = useState<string>('');
  const [showActualImage, setShowActualImage] = useState<{ [idx: number]: boolean }>({});
  const [galleryRings, setGalleryRings] = useState<Array<{
    image: string;
    actualImage: string;
    status: string;
    walletAddress: string;
    attributes: any[];
    profileId: string;
    metadataIpfs?: string;
    animation_url?: string;  // Add GLB model URL property
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [ringMetadata, setRingMetadata] = useState<{ [key: string]: any }>({});

  // Convert IPFS URL to HTTP URL
  const convertIpfsUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('ipfs://')
      ? url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
      : url;
  };

  // Fetch materials
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
            modelUrl: data.modelUrl,
          };
        });
        setMaterials(materialsList);
      } catch (error) {
        console.error('Error fetching materials:', error);
      }
    };
    fetchMaterials();
  }, []);

  useEffect(() => {
    const fetchGalleryRings = async () => {
      setLoading(true);
      const profilesRef = collection(db, 'walletProfiles');
      const snapshot = await getDocs(profilesRef);
      const rings: Array<{ 
        image: string; 
        actualImage: string; 
        status: string; 
        walletAddress: string; 
        attributes: any[];
        usdzUrl?: string; 
        profileId: string; 
        metadataIpfs?: string;
        animation_url?: string;  // Add GLB model URL property
      }> = [];
      let debugAllRings: any[] = [];
      const metadata: { [key: string]: any } = {};
      const newMetadata: { [key: string]: any } = {};

      for (const doc of snapshot.docs) {
        const profile = doc.data() as RingProfile;
        const walletAddress = profile.walletAddress || '';
        
        for (const ring of (profile.rings || [])) {
          debugAllRings.push({
            status: ring.status,
            walletAddress,
            ring,
            profileId: doc.id
          });
          
          if (ring.status === 'in transit' || ring.status === 'completed') {
            let image = '';
            if (ring.imageIpfs) {
              image = ring.imageIpfs.startsWith('ipfs://')
                ? ring.imageIpfs.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                : ring.imageIpfs;
            }
            let actualImage = '';
            if (ring.actualImage) {
              actualImage = ring.actualImage.startsWith('ipfs://')
                ? ring.actualImage.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                : ring.actualImage;
            }

            // Process metadata
            if (ring.metadataIpfs) {
              try {
                const metadataUrl = ring.metadataIpfs.startsWith('ipfs://')
                  ? ring.metadataIpfs.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                  : ring.metadataIpfs;
                console.log('Fetching metadata from:', metadataUrl);
                const response = await axios.get(metadataUrl, {
                  timeout: 5000, // 5 second timeout
                  headers: {
                    'Accept': 'application/json'
                  }
                });
                if (!response.data) {
                  throw new Error('No metadata received');
                }
                const metadata = response.data;
                
                // Convert animation_url if it exists
                if (metadata.animation_url) {
                  metadata.animation_url = metadata.animation_url.startsWith('ipfs://')
                    ? metadata.animation_url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                    : metadata.animation_url;
                  console.log('Found GLB model URL:', metadata.animation_url);
                }
                
                // Store processed metadata
                newMetadata[doc.id + '-' + image] = metadata;
                
                // Process model URLs for both platforms
                const glbUrl = metadata.animation_url;
                const usdzUrl = metadata.ios_animation_url || glbUrl?.replace('.glb', '.usdz');
                
                // Add ring with metadata attributes and platform-specific model URLs
                rings.push({
                  image,
                  actualImage,
                  status: ring.status || '',
                  walletAddress,
                  attributes: metadata.attributes || [],
                  profileId: doc.id,
                  metadataIpfs: ring.metadataIpfs,
                  animation_url: glbUrl, // GLB for Android
                  usdzUrl: usdzUrl // USDZ for iOS
                });
              } catch (error) {
                console.error('Error fetching metadata:', error);
                // Try alternative IPFS gateway if Pinata fails
                try {
                  const altMetadataUrl = ring.metadataIpfs.startsWith('ipfs://')
                    ? ring.metadataIpfs.replace('ipfs://', 'https://ipfs.io/ipfs/')
                    : ring.metadataIpfs;
                  console.log('Retrying with alternative gateway:', altMetadataUrl);
                  const altResponse = await axios.get(altMetadataUrl, {
                    timeout: 5000,
                    headers: {
                      'Accept': 'application/json'
                    }
                  });
                  if (!altResponse.data) {
                    throw new Error('No metadata received from alternative gateway');
                  }
                  const metadata = altResponse.data;
                  newMetadata[doc.id + '-' + image] = metadata;
                  rings.push({
                    image,
                    actualImage,
                    status: ring.status || '',
                    walletAddress,
                    attributes: metadata.attributes || [],
                    profileId: doc.id,
                    metadataIpfs: ring.metadataIpfs,
                    animation_url: metadata.animation_url
                  });
                } catch (retryError) {
                  console.error('Error fetching metadata from alternative gateway:', retryError);
                  rings.push({
                    image,
                    actualImage,
                    status: ring.status || '',
                    walletAddress,
                    attributes: ring.attributes || [],
                    profileId: doc.id,
                    metadataIpfs: ring.metadataIpfs
                  });
                }
              }
            } else {
              rings.push({
                image,
                actualImage,
                status: ring.status || '',
                walletAddress,
                attributes: ring.attributes || [],
                profileId: doc.id
              });
            }
          }
        }
      }
      
      // Debug log: all rings and their statuses
      console.log('[Gallery Debug] All fetched rings:', debugAllRings);
      setGalleryRings(rings);
      setRingMetadata(newMetadata);
      setLoading(false);
      // Debug log: all rings and their statuses
      // eslint-disable-next-line no-console
      console.log('[Gallery Debug] All fetched rings:', debugAllRings);
      setGalleryRings(rings);
      setLoading(false);
    };
    fetchGalleryRings();
  }, []);


  return (
    <Box minH="100vh" w="100vw" bgGradient="linear(to-br, #fff 0%, #222 100%)" py={12} px={2}>
      <Box maxW="1100px" mx="auto" py={10} px={{ base: 2, md: 8 }} bg="rgba(255,255,255,0.98)" borderRadius="3xl" boxShadow="0 8px 40px rgba(0,0,0,0.10)" border="1px solid #222">
        <Box mb={8} position="relative" display="flex" alignItems="center" justifyContent="center">
          <Heading
            fontSize={{ base: '2.7xl', md: '4xl' }}
            fontWeight="extrabold"
            color="#111"
            textAlign="center"
            letterSpacing="1.5px"
            style={{ position: 'relative', zIndex: 1, fontFamily: 'Montserrat, sans-serif', textShadow: '0 2px 12px #eee' }}
          >
            Aptos Rings Gallery
          </Heading>
          <Box position="absolute" top={0} right={0} zIndex={2}>
            <button
              style={{
                background: 'linear-gradient(90deg,#222 0%,#555 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 24px',
                fontWeight: 'bold',
                fontSize: '17px',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                marginLeft: '12px',
                transition: 'transform 0.2s',
              }}
              onClick={() => {
                if (navigate) {
                  navigate('/UserPage');
                } else if (window.location) {
                  window.location.href = '/UserPage';
                }
              }}
              onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.07)')}
              onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Home
            </button>
          </Box>
        </Box>
        {loading ? (
          <Box textAlign="center" py={10}><Spinner size="lg" color="#222" /></Box>
        ) : galleryRings.length === 0 ? (
          <Text textAlign="center" color="#222" fontSize="xl" fontWeight="bold">No rings found in transit or completed.</Text>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={{ base: 7, md: 12 }}>
            {galleryRings.map((ring, idx) => {
              const isShowingActual = showActualImage[idx] === true;
              const canToggle = ring.actualImage && ring.image;
              const mainImage = isShowingActual && ring.actualImage ? ring.actualImage : ring.image;
              const smallImage = isShowingActual && ring.actualImage ? ring.image : ring.actualImage;
              const smallAlt = isShowingActual ? 'NFT Preview' : 'Actual Image';
              return (
                <Box
                  key={idx}
                  borderRadius="2xl"
                  boxShadow="0 4px 32px rgba(0,0,0,0.13)"
                  bg="linear-gradient(120deg,#fff 60%,#f4f4f4 100%)"
                  p={7}
                  textAlign="center"
                  position="relative"
                  border="1.5px solid #222"
                  transition="box-shadow 0.2s, transform 0.2s"
                  _hover={{ boxShadow: '0 8px 40px rgba(0,0,0,0.22)', transform: 'scale(1.03)' }}
                  style={{ animation: 'fadeIn 0.7s', minHeight: '370px' }}
                >
                  <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={4}>
                    <Box position="relative" display="flex" alignItems="center" justifyContent="center" bg="transparent" borderRadius="2xl" p={3} minH="200px" minW="200px" border="1px solid #222">
                      {ring.metadataIpfs && (
                        <>
                          {ring.animation_url ? (
                            <RingPreview
                              width={200}
                              height={200}
                              coreUrl={ring.animation_url}
                            />
                          ) : (
                            <Box p={4}>
                              <Spinner size="lg" color="#222" />
                              <Text mt={2} fontSize="sm" color="#666">Loading 3D model...</Text>
                            </Box>
                          )}
                        </>
                      )}
                      {/* Show actual image if available */}
                      {ring.actualImage && (
                        <Box
                          position="absolute"
                          bottom={-18}
                          left={-18}
                          bgGradient="linear(to-br,#222 0%,#555 100%)"
                          borderRadius="xl"
                          boxShadow="0 2px 12px rgba(0,0,0,0.18)"
                          p={2}
                          border="2.5px solid #fff"
                          zIndex={2}
                        >
                          <Image
                            src={ring.actualImage}
                            alt="Actual Ring"
                            boxSize={{ base: '54px', md: '72px' }}
                            objectFit="contain"
                            borderRadius="xl"
                            bg="#fff"
                          />
                        </Box>
                      )}
                    </Box>
                    <Text fontSize="md" color="#111" fontWeight="bold" mb={1} mt={3} letterSpacing="0.5px" fontFamily="Montserrat, sans-serif">
                      {ring.walletAddress ? `${ring.walletAddress.slice(0, 6)}...${ring.walletAddress.slice(-6)}` : ''}
                    </Text>
                    <Text fontSize="sm" color={ring.status === 'completed' ? '#222' : '#555'} fontWeight="extrabold" mb={1} letterSpacing="0.5px" textTransform="uppercase" fontFamily="Montserrat, sans-serif">
                      {ring.status.charAt(0).toUpperCase() + ring.status.slice(1)}
                    </Text>
                    {ring.attributes && ring.attributes.length > 0 && (
                    <Box fontSize="sm" color="#222" mt={2} bg="#f7f7fa" borderRadius="md" px={3} py={2} border="1px solid #222" boxShadow="0 1px 4px rgba(0,0,0,0.04)">
                        {ring.attributes.map((attr: any, i: number) => (
                          <Text key={i} mb={1}>
                            <span style={{ color: '#111', fontWeight: 600 }}>{attr.trait_type}:</span> <span style={{ color: '#555' }}>{attr.value}</span>
                          </Text>
                        ))}
                      </Box>
                    )}
                    {ring.animation_url && (
                      <IconButton
                        aria-label="View in AR"
                        icon={<ViewIcon />}
                        position="absolute"
                        top={2}
                        right={2}
                        colorScheme="blue"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModelUrl(ring.animation_url || '');
                          onOpen();
                        }}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
        
        {/* AR QR Code Modal */}
        <ARQRCodeModal
          isOpen={isOpen}
          onClose={onClose}
          modelUrl={selectedModelUrl}
        />
      </Box>
      {/* Animation keyframes for fadeIn */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Box>
  );
};

export default GalleryPage;
