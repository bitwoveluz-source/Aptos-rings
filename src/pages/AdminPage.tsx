import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Input,
  Button,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Select,
  useToast,
  Text,
  HStack,
  IconButton,
  Divider,
  Image,
} from "@chakra-ui/react";
import { DeleteIcon } from '@chakra-ui/icons';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToPinata } from '../services/pinata';
// No duplicate import needed

interface MaterialInput {
  name: string;
  type: string;
  entry?: string;
  imageUrl?: string;
  ipfsHash?: string;
  metadataUrl?: string;
  metadataHash?: string;
  price?: number;
}

interface Material extends MaterialInput {
  id: string;
}

const AdminPage = () => {
  type StatusType = 'all' | 'in queue' | 'crafting' | 'in transit' | 'completed';
  const [statusFilter, setStatusFilter] = useState<StatusType>('all');
  type RingProfile = {
    id: string;
    walletAddress?: string;
    rings?: Array<{
      metadataIpfs?: string;
      deliveryAddress?: string;
      status?: string;
      attributes?: any[];
      imageIpfs?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  const [profiles, setProfiles] = useState<RingProfile[]>([]);
  const [materialInput, setMaterialInput] = useState<MaterialInput>({
    name: '',
    type: '',
    entry: '',
    imageUrl: '',
    price: 0
  });
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ringMetas, setRingMetas] = useState<{ [key: string]: any }>({});
  const toast = useToast();
  // Move all type and state declarations to the top
  // Helper to fetch and parse ring metadata from IPFS
  const fetchRingAttributes = async (metadataIpfs: string) => {
    try {
      if (!metadataIpfs) return null;
      // Convert ipfs:// to https://gateway.pinata.cloud/ipfs/
      const url = metadataIpfs.startsWith('ipfs://')
        ? metadataIpfs.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
        : metadataIpfs;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (err) {
      return null;
    }
  };

  // State to store fetched ring metadata for each ring

  // Fetch all ring metadata when profiles change

  useEffect(() => {
    const fetchAllRingMetas = async () => {
      const metaPromises: Promise<[string, any]>[] = [];
      profiles.forEach(profile => {
        profile.rings?.forEach((ring, idx) => {
          if (ring.metadataIpfs) {
            const key = profile.id + '-' + idx;
            metaPromises.push(
              fetchRingAttributes(ring.metadataIpfs).then(meta => [key, meta])
            );
          }
        });
      });
      const results = await Promise.all(metaPromises);
      const metaObj: { [key: string]: any } = {};
      results.forEach(([key, meta]) => {
        if (meta) metaObj[key] = meta;
      });
      setRingMetas(metaObj);
    };
    if (profiles.length > 0) fetchAllRingMetas();
  }, [profiles]);

  useEffect(() => {
    fetchMaterials();
    fetchProfilesWithRings();
  }, []);

  // Fetch profiles that created a ring
  const fetchProfilesWithRings = async () => {
    try {
      const profilesRef = collection(db, 'walletProfiles');
      const snapshot = await getDocs(profilesRef);
      const profilesList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as RingProfile))
        .filter(profile => Array.isArray(profile.rings) && profile.rings.length > 0);
      setProfiles(profilesList);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch profiles',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Render profiles in a table/grid
  const renderProfilesTable = () => (
    <Box mt={10}>
      <Heading size="lg" mb={6} fontWeight="bold" color="#2d3748" letterSpacing="1px">Ring List</Heading>
      {/* Status Filter Toggle */}
      <Box mb={4} display="flex" gap={2} alignItems="center">
        <Text fontWeight="bold" fontSize="15px" color="#2d3748" mr={2}>Show:</Text>
        <Button
          size="sm"
          variant={statusFilter === 'all' ? 'solid' : 'outline'}
          colorScheme="blue"
          onClick={() => setStatusFilter('all')}
        >All</Button>
        <Button
          size="sm"
          variant={statusFilter === 'in queue' ? 'solid' : 'outline'}
          colorScheme="blue"
          onClick={() => setStatusFilter('in queue')}
        >In Queue</Button>
        <Button
          size="sm"
          variant={statusFilter === 'crafting' ? 'solid' : 'outline'}
          colorScheme="blue"
          onClick={() => setStatusFilter('crafting')}
        >Crafting</Button>
        <Button
          size="sm"
          variant={statusFilter === 'in transit' ? 'solid' : 'outline'}
          colorScheme="blue"
          onClick={() => setStatusFilter('in transit')}
        >In Transit</Button>
        <Button
          size="sm"
          variant={statusFilter === 'completed' ? 'solid' : 'outline'}
          colorScheme="blue"
          onClick={() => setStatusFilter('completed')}
        >Completed</Button>
      </Box>
      {profiles.length === 0 ? (
        <Text color="gray.500">No profiles have created a ring yet.</Text>
      ) : (
        <Box overflowX="auto">
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '16px', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Wallet Address</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '16px', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Ring Image</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '16px', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Attributes</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '16px', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                profile.rings?.map((ring, idx) => {
                  if (statusFilter !== 'all' && ring.status !== statusFilter) return null;
                  const key = profile.id + '-' + idx;
                  const meta = ringMetas[key];
                  return (
                    <tr key={key} style={{ background: '#f9fafb', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', border: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '15px', color: '#2b6cb0', background: '#edf2f7', borderRadius: '8px' }}>
                        {profile.walletAddress
                          ? `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-6)}`
                          : '—'}
                      </td>
                      <td style={{ padding: '16px', background: '#fff', borderRadius: '8px', textAlign: 'center' }}>
                        {meta && meta.image ? (
                          <img src={meta.image} alt="Ring" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #cbd5e0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} />
                        ) : (ring.imageIpfs ? (
                          <img src={ring.imageIpfs} alt="Ring" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #cbd5e0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} />
                        ) : '—')}
                      </td>
                      <td style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                        {meta && Array.isArray(meta.attributes) ? (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {meta.attributes.map((attr: any, i: number) => (
                              <li key={i} style={{ fontSize: '14px', color: '#2d3748', marginBottom: '4px', background: '#e6fffa', borderRadius: '6px', padding: '4px 8px', display: 'inline-block' }}>
                                <strong>{attr.trait_type}:</strong> {attr.value}
                              </li>
                            ))}
                          </ul>
                        ) : (Array.isArray(ring.attributes) ? (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {ring.attributes.map((attr: any, i: number) => (
                              <li key={i} style={{ fontSize: '14px', color: '#2d3748', marginBottom: '4px', background: '#e6fffa', borderRadius: '6px', padding: '4px 8px', display: 'inline-block' }}>
                                <strong>{attr.trait_type}:</strong> {attr.value}
                              </li>
                            ))}
                          </ul>
                        ) : '—')}
                        {ring.deliveryAddress && (
                          <div style={{ fontSize: '13px', color: '#718096', marginTop: '6px', background: '#fefcbf', borderRadius: '6px', padding: '4px 8px', display: 'inline-block' }}>Delivery: {ring.deliveryAddress}</div>
                        )}
                      </td>
                      <td style={{ padding: '16px', background: '#fff', borderRadius: '8px', fontWeight: 'bold', color: '#38a169', textAlign: 'center' }}>
                        <select
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontWeight: 'bold', color: '#2d3748', background: '#f7fafc' }}
                          value={ring.status || ''}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            // Update status in Firestore
                            try {
                              const profileRef = doc(db, 'walletProfiles', profile.id);
                              // Get current profile data
                              const profileSnap = await getDocs(collection(db, 'walletProfiles'));
                              const profileDoc = profileSnap.docs.find(d => d.id === profile.id);
                              if (!profileDoc) return;
                              const profileData = profileDoc.data();
                              const rings = Array.isArray(profileData.rings) ? [...profileData.rings] : [];
                              rings[idx] = { ...rings[idx], status: newStatus };
                              await updateDoc(profileRef, { rings });
                              // Update local state
                              setProfiles(prev => prev.map(p =>
                                p.id === profile.id
                                  ? { ...p, rings: p.rings?.map((r, i) => i === idx ? { ...r, status: newStatus } : r) }
                                  : p
                              ));
                            } catch (err) {
                              toast({ title: 'Error', description: 'Failed to update status', status: 'error', duration: 3000, isClosable: true });
                            }
                          }}
                        >
                          <option value="">—</option>
                          <option value="in queue">in queue</option>
                          <option value="crafting">crafting</option>
                          <option value="in transit">in transit</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );

  const fetchMaterials = async () => {
    try {
      console.log('Fetching materials...');
      const materialsRef = collection(db, 'materials');
      const materialsSnapshot = await getDocs(materialsRef);
      const materialsList = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];
      console.log('Materials fetched:', materialsList);
  setMaterials(materialsList);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch materials',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMaterialInput(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!materialInput.name || !materialInput.type) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (!selectedImage) {
      toast({
        title: 'Error',
        description: 'Please select an image',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setIsUploading(true);
    try {
        // Check for existing material (name+type+entry must be unique)
        const materialsRef = collection(db, 'materials');
        const q = query(
          materialsRef,
          where('name', '==', materialInput.name),
          where('type', '==', materialInput.type),
          where('entry', '==', materialInput.entry || '')
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast({
            title: 'Error',
            description: `A material with name "${materialInput.name}", type "${materialInput.type}", and entry "${materialInput.entry}" already exists`,
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          setIsUploading(false);
          return;
        }
      // Upload image to Pinata first
      const { ipfsUrl: imageUrl, ipfsHash: imageHash } = await uploadToPinata(selectedImage);
      if (!imageUrl || !imageHash) {
        throw new Error('Failed to get IPFS URL or hash from image upload');
      }

      // Create metadata JSON
      const metadata = {
        name: `Ring Material - ${materialInput.name}`,
        description: `Aptos Rings NFT Material - ${materialInput.type}`,
        image: imageUrl,
        attributes: [
          {
            trait_type: "Material Type",
            value: materialInput.type
          },
          {
            trait_type: "Material Name",
            value: materialInput.name
          },
          {
            trait_type: "Entry Type",
            value: materialInput.entry || "single"
          }
        ]
      };

      // Convert metadata to Blob for upload
      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], `${materialInput.name.toLowerCase().replace(/\s+/g, '-')}-metadata.json`, { type: 'application/json' });
      
      // Upload metadata to Pinata
      const { ipfsUrl: metadataUrl, ipfsHash: metadataHash } = await uploadToPinata(metadataFile);
      if (!metadataUrl || !metadataHash) {
        throw new Error('Failed to get IPFS URL or hash from metadata upload');
      }

      // Add new material with IPFS data
      const newMaterial = {
        ...materialInput,
        imageUrl: imageUrl,
        ipfsHash: imageHash,
        metadataUrl: metadataUrl,
        metadataHash: metadataHash,
        createdAt: new Date().toISOString(),
      };
      await addDoc(materialsRef, newMaterial);
      setMaterialInput({ name: '', type: '', entry: '', imageUrl: '', price: 0 });
      setSelectedImage(null);
      toast({
        title: 'Success',
        description: 'Material added successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await fetchMaterials();
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Error',
        description: error.message || 'Failed to add material',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (materialId: string) => {
    try {
      console.log('Starting delete process for material:', materialId);
      
      // Get the material data
  const material = materials.find(m => m.id === materialId);
      console.log('Found material:', material);
      
      // Delete the document from Firestore
      console.log('Deleting from Firestore...');
      await deleteDoc(doc(db, 'materials', materialId));
      
      // Note: Images on IPFS cannot be deleted, they will persist

      console.log('Refreshing materials list...');
      await fetchMaterials(); // Refresh the list
      toast({
        title: 'Success',
        description: 'Material deleted successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error in delete process:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete material',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const renderMaterialsByType = (type: string) => {
  const filteredMaterials = materials.filter(material => material.type === type);
    return (
      <Box mb={4}>
        <Heading size="md" mb={2} textTransform="capitalize">{type} Materials</Heading>
        {filteredMaterials.length === 0 ? (
          <Text color="gray.500">No {type} materials added yet</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {filteredMaterials.map(material => (
              <HStack key={material.id} justify="space-between" p={2} bg="gray.50" borderRadius="md">
                <HStack spacing={3}>
                  {material.imageUrl && (
                    <Image
                      src={material.imageUrl}
                      alt={material.name}
                      boxSize="40px"
                      objectFit="cover"
                      borderRadius="md"
                    />
                  )}
                  <Box>
                    <Text>{material.name}</Text>
                    {material.entry && (
                      <Text fontSize="xs" color="gray.500">Entry: {material.entry}</Text>
                    )}
                  </Box>
                </HStack>
                <IconButton
                  aria-label="Delete material"
                  icon={<DeleteIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => handleDelete(material.id)}
                />
              </HStack>
            ))}
          </VStack>
        )}
      </Box>
    );
  };

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={6} align="stretch">
        <Heading textAlign="center" mb={8}>Admin Dashboard</Heading>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
          <Heading size="md" mb={4}>Add New Material</Heading>
          <FormControl>
            <FormLabel>Material Name</FormLabel>
            <Input
              name="name"
              value={materialInput.name}
              onChange={handleInputChange}
              placeholder="Enter material name"
            />
          </FormControl>
          <FormControl mb={4} isRequired>
            <FormLabel>Entry</FormLabel>
            <Select
              name="entry"
              value={materialInput.entry}
              onChange={handleInputChange}
              placeholder="Select entry type"
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="triple">Triple</option>
            </Select>
          </FormControl>

        <FormControl mt={4}>
          <FormLabel>Material Type</FormLabel>
          <Select
            name="type"
            value={materialInput.type}
            onChange={handleInputChange}
            placeholder="Select material type"
          >
            <option value="core">Core</option>
            <option value="inlay1">Inlay 1</option>
            <option value="inlay2">Inlay 2</option>
            <option value="inlay3">Inlay 3</option>
            <option value="finish">Finish</option>
          </Select>
        </FormControl>

        <FormControl mt={4}>
          <FormLabel>Price</FormLabel>
          <Input
            name="price"
            type="number"
            value={materialInput.price || ''}
            onChange={handleInputChange}
            placeholder="Enter material price"
          />
        </FormControl>          <FormControl mt={4}>
            <FormLabel>Material Image</FormLabel>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.jfif"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Check file size (max 2MB)
                  if (file.size > 2 * 1024 * 1024) {
                    toast({
                      title: 'Error',
                      description: 'Image size should be less than 2MB',
                      status: 'error',
                      duration: 3000,
                      isClosable: true,
                    });
                    e.target.value = ''; // Reset input
                    return;
                  }

                  // Check file type
                  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/jfif'];
                  if (!validTypes.includes(file.type)) {
                    toast({
                      title: 'Error',
                      description: 'Please upload a valid image file (JPG, PNG, or WebP)',
                      status: 'error',
                      duration: 3000,
                      isClosable: true,
                    });
                    e.target.value = ''; // Reset input
                    return;
                  }

                  console.log('File selected:', {
                    name: file.name,
                    type: file.type,
                    size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
                  });

                  setSelectedImage(file);
                }
              }}
              p={1}
            />
            {selectedImage && (
              <Box mt={2}>
                <Text fontSize="sm">Selected: {selectedImage.name}</Text>
                <Text fontSize="xs" color="gray.500">
                  Size: {(selectedImage.size / (1024 * 1024)).toFixed(2)}MB
                </Text>
              </Box>
            )}
            <Text fontSize="xs" color="gray.500" mt={1}>
              Accepted formats: JPG, JFIF, PNG, WebP (Max size: 2MB)
            </Text>
          </FormControl>

          <Button
            colorScheme="blue"
            size="lg"
            mt={4}
            width="100%"
            onClick={handleSubmit}
            isLoading={isUploading}
            loadingText="Adding Material..."
          >
            Add Material
          </Button>
        </Box>

        <Divider my={4} />

        <Box>
          <Heading size="lg" mb={4}>Material List</Heading>
          {renderMaterialsByType('core')}
          {renderMaterialsByType('inlay1')}
          {renderMaterialsByType('inlay2')}
          {renderMaterialsByType('inlay3')}
          {renderMaterialsByType('finish')}
        </Box>
        {/* New section for profiles that created a ring */}
        {renderProfilesTable()}
      </VStack>
    </Container>
  );
};

export default AdminPage;