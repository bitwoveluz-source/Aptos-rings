import React, { useEffect, useState } from 'react';
import { Box, Heading, SimpleGrid, Image, Text, Spinner } from '@chakra-ui/react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Ring {
  metadataIpfs?: string;
  imageIpfs?: string;
  status?: string;
  attributes?: any[];
  [key: string]: any;
}

interface RingProfile {
  id: string;
  walletAddress?: string;
  rings?: Ring[];
}

const GalleryPage: React.FC = () => {
  const navigate = (window as any).navigate || undefined;
  // If using react-router-dom v6, use the hook:
  // import { useNavigate } from 'react-router-dom';
  // const navigate = useNavigate();
  // Track which image is shown for each ring (actual or NFT)
  const [showActualImage, setShowActualImage] = useState<{ [idx: number]: boolean }>({});
  const [galleryRings, setGalleryRings] = useState<Array<{
    image: string;
    actualImage: string;
    status: string;
    walletAddress: string;
    attributes: any[];
    profileId: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGalleryRings = async () => {
      setLoading(true);
      const profilesRef = collection(db, 'walletProfiles');
      const snapshot = await getDocs(profilesRef);
      const rings: Array<{ image: string; actualImage: string; status: string; walletAddress: string; attributes: any[]; profileId: string }> = [];
      let debugAllRings: any[] = [];
      snapshot.docs.forEach(doc => {
        const profile = doc.data() as RingProfile;
        const walletAddress = profile.walletAddress || '';
        profile.rings?.forEach(ring => {
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
            rings.push({
              image,
              actualImage,
              status: ring.status || '',
              walletAddress,
              attributes: ring.attributes || [],
              profileId: doc.id,
            });
          }
        });
      });
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
                    <Box position="relative" display="flex" alignItems="center" justifyContent="center" bg="#f4f4f6" borderRadius="2xl" p={3} minH="140px" minW="140px" border="1px solid #222">
                      {/* Main Image (NFT or Actual) */}
                      {mainImage ? (
                        <Image
                          src={mainImage}
                          alt={isShowingActual ? 'Actual Ring' : 'NFT Preview'}
                          boxSize={{ base: '140px', md: '200px' }}
                          objectFit="cover"
                          borderRadius="xl"
                          boxShadow="0 2px 12px rgba(0,0,0,0.13)"
                          style={{ background: '#fff', transition: 'box-shadow 0.2s' }}
                        />
                      ) : (
                        <Box boxSize={{ base: '140px', md: '200px' }} borderRadius="xl" bg="#e2e8f0" display="flex" alignItems="center" justifyContent="center" color="#bbb" fontSize="md">No Image</Box>
                      )}
                      {/* Small image overlayed in corner, clickable to toggle */}
                      {canToggle && smallImage && (
                        <Box
                          position="absolute"
                          bottom={-18}
                          left={-18}
                          bgGradient="linear(to-br,#222 0%,#555 100%)"
                          borderRadius="xl"
                          boxShadow="0 2px 12px rgba(0,0,0,0.18)"
                          p={2}
                          border="2.5px solid #fff"
                          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                          onClick={() => setShowActualImage(prev => ({ ...prev, [idx]: !isShowingActual }))}
                          title={isShowingActual ? 'Show NFT Preview' : 'Show Actual Image'}
                          zIndex={2}
                          _hover={{ boxShadow: '0 4px 24px rgba(0,0,0,0.28)', transform: 'scale(1.12)' }}
                        >
                          <Image
                            src={smallImage}
                            alt={smallAlt}
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
                  </Box>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
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
