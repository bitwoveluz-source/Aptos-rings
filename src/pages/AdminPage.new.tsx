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
  imageUrl: string;
  ipfsHash?: string;
}

interface Material extends MaterialInput {
  id: string;
}

const AdminPage = () => {
  const [materialInput, setMaterialInput] = useState<MaterialInput>({
    name: '',
    type: '',
    imageUrl: '',
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
      const materialsRef = collection(db, 'materials');
      const materialsSnapshot = await getDocs(materialsRef);
      const materialsList = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];
      setMaterials(materialsList);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch materials',
        status: 'error',
        duration: 3000,
        isClosable: true
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
    console.log('Starting submission process...');
    
    if (!materialInput.name || !materialInput.type) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    if (!selectedImage) {
      toast({
        title: 'Error',
        description: 'Please select an image',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    setIsUploading(true);

    try {
      // Check for existing material
      const materialsRef = collection(db, 'materials');
      const q = query(
        materialsRef, 
        where('name', '==', materialInput.name),
        where('type', '==', materialInput.type)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        throw new Error(`A ${materialInput.type} material with name "${materialInput.name}" already exists`);
      }

      // Upload to Pinata
      console.log('Uploading to Pinata:', {
        name: selectedImage.name,
        size: `${(selectedImage.size / (1024 * 1024)).toFixed(2)}MB`,
        type: selectedImage.type
      });

      const { ipfsUrl, ipfsHash } = await uploadToPinata(selectedImage);
      console.log('Pinata upload response:', { ipfsUrl, ipfsHash });

      if (!ipfsUrl || !ipfsHash) {
        throw new Error('Failed to get IPFS URL or hash from upload');
      }

      // Create new material with IPFS data
      const newMaterial = {
        ...materialInput,
        imageUrl: ipfsUrl,
        ipfsHash,
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      await addDoc(materialsRef, newMaterial);
      console.log('Saved to Firestore:', newMaterial);

      // Reset form
      setMaterialInput({
        name: '',
        type: '',
        imageUrl: '',
      });
      setSelectedImage(null);

      // Show success message
      toast({
        title: 'Success',
        description: 'Material added successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true
      });

      // Refresh materials list
      await fetchMaterials();
    } catch (err) {
      const error = err as Error;
      console.error('Error in submission:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add material',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (materialId: string) => {
    try {
      await deleteDoc(doc(db, 'materials', materialId));
      await fetchMaterials();
      toast({
        title: 'Success',
        description: 'Material deleted successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      console.error('Error in delete process:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete material',
        status: 'error',
        duration: 3000,
        isClosable: true
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
                  <Text>{material.name}</Text>
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

          <FormControl mt={4}>
            <FormLabel>Material Type</FormLabel>
            <Select
              name="type"
              value={materialInput.type}
              onChange={handleInputChange}
              placeholder="Select material type"
            >
              <option value="core">Core</option>
              <option value="inlay">Inlay</option>
              <option value="finish">Finish</option>
            </Select>
          </FormControl>

          <FormControl mt={4}>
            <FormLabel>Material Image</FormLabel>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Check file size (max 2MB)
                  if (file.size > 2 * 1024 * 1024) {
                    toast({
                      title: 'Error',
                      description: 'Image size should be less than 2MB',
                      status: 'error',
                      duration: 3000,
                      isClosable: true
                    });
                    e.target.value = '';
                    return;
                  }

                  // Check file type
                  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                  if (!validTypes.includes(file.type)) {
                    toast({
                      title: 'Error',
                      description: 'Please upload a valid image file (JPG, PNG, or WebP)',
                      status: 'error',
                      duration: 3000,
                      isClosable: true
                    });
                    e.target.value = '';
                    return;
                  }

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
              Accepted formats: JPG, PNG, WebP (Max size: 2MB)
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
          {renderMaterialsByType('inlay')}
          {renderMaterialsByType('finish')}
        </Box>
      </VStack>
    </Container>
  );
};

export default AdminPage;