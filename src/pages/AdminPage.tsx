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
import { db } from '../firebase';
import { uploadToPinata } from '../services/pinata';

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
  const toast = useToast();

  useEffect(() => {
    fetchMaterials();
  }, []);

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

  const handleImageUpload = async (file: File) => {
    try {
      if (!file) {
        throw new Error('No file provided for upload');
      }

      console.log('Starting image upload to IPFS...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const { ipfsUrl, ipfsHash } = await uploadToPinata(file);
      
      if (!ipfsUrl || !ipfsHash) {
        throw new Error('Upload successful but missing IPFS URL or hash');
      }

      console.log('Image uploaded to IPFS:', { ipfsUrl, ipfsHash });
      return { url: ipfsUrl, ipfsHash };
    } catch (error) {
      console.error('Image upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image to IPFS';
      throw new Error(errorMessage);
    }
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
  const material = materials.find((m: Material) => m.id === materialId);
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
  const filteredMaterials = materials.filter((material: Material) => material.type === type);
    return (
      <Box mb={4}>
        <Heading size="md" mb={2} textTransform="capitalize">{type} Materials</Heading>
        {filteredMaterials.length === 0 ? (
          <Text color="gray.500">No {type} materials added yet</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {filteredMaterials.map((material: Material) => (
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
      </VStack>
    </Container>
  );
};

export default AdminPage;