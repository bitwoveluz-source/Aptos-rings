import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';

interface RingPreviewProps {
  coreUrl?: string;
  inlayUrls?: string[];
  finishUrl?: string;
  width?: number;
  height?: number;
}

export const RingPreview = ({ 
  coreUrl, 
  inlayUrls = [], 
  finishUrl,
  width = 400,
  height = 400 
}: RingPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    if (!canvasRef.current) {
      setIsLoading(false);
      return;
    }

    if (!canvasRef.current) {
      setIsLoading(false);
      return;
    }

    const canvas = canvasRef.current;
    
    // Setup renderer with high quality settings
      const renderer = new THREE.WebGLRenderer({ 
        canvas, 
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      rendererRef.current = renderer;
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0); // Set fully transparent background
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Setup scene with environment
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create and add high-quality environment map
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileCubemapShader();
      
      // Create a more complex environment for better reflections
      const envScene = new THREE.Scene();
      const envGeometry = new THREE.SphereGeometry(10, 32, 32);
      
      // Create bright environment materials for metallic reflections
      const gradientMaterial = new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(0xffffff) },
          middleColor: { value: new THREE.Color(0xe0e0ff) },
          bottomColor: { value: new THREE.Color(0xfffaf0) }
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 middleColor;
          uniform vec3 bottomColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            vec3 color = h > 0.0 
              ? mix(middleColor, topColor, h)
              : mix(middleColor, bottomColor, -h);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        side: THREE.BackSide
      });
      
      const envMesh = new THREE.Mesh(envGeometry, gradientMaterial);
      envScene.add(envMesh);
      
      const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
      scene.environment = envMap;
      pmremGenerator.dispose();

      // Setup camera with optimal viewing angle for rings
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
      camera.position.set(0, 0.5, 4); // Slightly elevated position for better ring view
      
      // Setup controls with improved settings for jewelry viewing
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.5; // Slightly slower for better examination
      controls.minDistance = 2.5;
      controls.maxDistance = 7;
      
      // Set optimal viewing angles
      controls.minPolarAngle = Math.PI / 4; // Limit how high camera can go
      controls.maxPolarAngle = Math.PI * 3/4; // Limit how low camera can go
      
      // Center the controls target
      controls.target.set(0, 0, 0);

    // Neutral lighting setup that preserves material appearance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Main light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(2, 2, 2);
    scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, -1, -1);
    scene.add(fillLight);

    // Add subtle point lights for sparkle
    const createSparkleLight = (position: THREE.Vector3, intensity: number, distance: number = 15) => {
      const light = new THREE.PointLight(0xffffff, intensity, distance);
      light.position.copy(position);
      scene.add(light);
    };

    // Strategic sparkle placement
    createSparkleLight(new THREE.Vector3(-3, 5, 2), 0.4, 20);  // Top-left sparkle
    createSparkleLight(new THREE.Vector3(2, -2, 3), 0.2, 15);  // Bottom-right fill
    createSparkleLight(new THREE.Vector3(0, 3, -2), 0.3, 15);  // Back sparkle

    // Load models with improved error handling and loading states
    const loader = new GLTFLoader();
    
    const loadModel = (url: string, position: THREE.Vector3 = new THREE.Vector3()) => {
      return new Promise<GLTF>((resolve, reject) => {
        if (!url) {
          reject(new Error('No URL provided'));
          return;
        }
        
        console.log('[RingPreview] Loading model from URL:', url);
        
        // Add loading manager for better tracking
        const loadingManager = new THREE.LoadingManager();
        loadingManager.onProgress = (url, loaded, total) => {
          console.log(`[RingPreview] Loading progress: ${Math.round((loaded / total) * 100)}% - ${url}`);
        };
        
        loader.load(
          url,
          (gltf: GLTF) => {
            // Setup materials and textures
            gltf.scene.traverse((node) => {
              if (node instanceof THREE.Mesh) {
                const mesh = node;
                
                // Handle materials
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach(material => {
                  // Preserve original material settings from GLB
                  if (material instanceof THREE.MeshStandardMaterial ||
                      material instanceof THREE.MeshPhysicalMaterial) {
                    // Only set color space for proper texture display
                    if (material.map) {
                      material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    material.needsUpdate = true;
                    material.needsUpdate = true;
                    
                    // Enhanced metallic properties
                    material.metalness = .90;    // Maximum metallic
                    material.roughness = 0.3;   // Very glossy
                    material.envMapIntensity = 50.0; // Strong reflections
                    
                    // Add slight clearcoat for extra shine
                    // Preserve original material properties
                    
                    if (material.map) {
                      // Optimize texture settings
                      material.map.needsUpdate = true;
                      material.map.flipY = false;
                      material.map.colorSpace = THREE.SRGBColorSpace;
                      
                      // Maximum texture quality
                      material.map.minFilter = THREE.LinearMipmapLinearFilter;
                      material.map.magFilter = THREE.LinearFilter;
                      material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                      material.map.generateMipmaps = true;
                      
                      // Enhance texture influence
                      material.envMapIntensity = 1.8;
                      material.normalScale = new THREE.Vector2(1.5, 1.5);
                    }
                    
                    // Enable smooth shading
                    material.flatShading = false;
                    
                    // Enable all material features
                    material.transparent = true;
                    material.opacity = 1.0;
                    material.side = THREE.DoubleSide;
                    
                    // Ensure proper material updates
                    material.needsUpdate = true;
                    
                    // Add environment map for reflections
                    const pmremGenerator = new THREE.PMREMGenerator(renderer);
                    pmremGenerator.compileEquirectangularShader();
                    
                    // Create a simple environment map
                    const cubeRenderTarget = pmremGenerator.fromScene(new THREE.Scene());
                    material.envMap = cubeRenderTarget.texture;
                    material.envMapIntensity = 1.0;
                    pmremGenerator.dispose();
                  }
                });
                
                // Ensure geometry and UVs are properly set up
                if (mesh.geometry) {
                  // Force UV channel 0 to be used
                  if (mesh.geometry.attributes.uv) {
                    mesh.geometry.attributes.uv.needsUpdate = true;
                  }
                  
                  // Check for second UV set
                  if (mesh.geometry.attributes.uv2) {
                    mesh.geometry.attributes.uv2.needsUpdate = true;
                  }
                  
                  // Ensure proper attributes
                  mesh.geometry.computeVertexNormals();
                  mesh.geometry.normalizeNormals();
                  
                  // Force geometry update
                  mesh.geometry.attributes.position.needsUpdate = true;
                  mesh.geometry.attributes.normal.needsUpdate = true;
                }
              }
            });

            // First, reset position and scale
            gltf.scene.position.set(0, 0, 0);
            gltf.scene.scale.set(1, 1, 1);
            
            // Calculate bounding box before any transformations
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Calculate scale to fit in a standardized size
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim; // Scale to fit in a 2x2x2 cube
            
            // Apply scale first
            gltf.scene.scale.multiplyScalar(scale);
            
            // Recenter after scaling
            gltf.scene.position.copy(position); // Apply any offset passed in
            gltf.scene.position.sub(center.multiplyScalar(scale)); // Center the model
            
            // Additional centering for Y-axis (vertical centering)
            const scaledBox = new THREE.Box3().setFromObject(gltf.scene);
            const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
            gltf.scene.position.y -= scaledCenter.y; // Ensure vertical center
            
            scene.add(gltf.scene);
            resolve(gltf);
          },
          (progress: { loaded: number; total: number }) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
          },
          (error: unknown) => {
            console.error('Error loading model:', error);
            reject(new Error(String(error)));
          }
        );
      });
    };

    // Load all models
    const loadAllModels = async () => {
      setIsLoading(true);
      try {
        const promises: Promise<GLTF>[] = [];
        
        // Group to hold all models
        const ringGroup = new THREE.Group();
        scene.add(ringGroup);
        
        // Load models in specific order: core -> inlays -> finish
        // Core layer (base ring)
        if (coreUrl) {
          console.log('[RingPreview] Loading core model:', coreUrl);
          promises.push(loadModel(coreUrl).then(gltf => {
            gltf.scene.traverse(node => {
              if (node instanceof THREE.Mesh) {
                node.renderOrder = 0; // Ensure core renders first
                // Ensure material is properly set up
                if (node.material instanceof THREE.Material) {
                  node.material.depthWrite = true;
                  node.material.depthTest = true;
                }
              }
            });
            ringGroup.add(gltf.scene);
            return gltf;
          }));
        }

        // Inlay layers
        for (const [index, url] of inlayUrls.entries()) {
          if (url) {
            console.log(`[RingPreview] Loading inlay model ${index + 1}:`, url);
            // Use minimal offset to prevent z-fighting but maintain alignment
            const offset = new THREE.Vector3(0, 0.0001 * (index + 1), 0);
            promises.push(loadModel(url, offset).then(gltf => {
              gltf.scene.traverse(node => {
                if (node instanceof THREE.Mesh) {
                  node.renderOrder = index + 1;
                  if (node.material instanceof THREE.Material) {
                    node.material.depthWrite = true;
                    node.material.depthTest = true;
                  }
                }
              });
              ringGroup.add(gltf.scene);
              return gltf;
            }));
          }
        }

        // Finish layer (if any)
        if (finishUrl) {
          console.log('[RingPreview] Loading finish model:', finishUrl);
          promises.push(loadModel(finishUrl).then(gltf => {
            gltf.scene.traverse(node => {
              if (node instanceof THREE.Mesh) {
                node.renderOrder = inlayUrls.length + 1;
                if (node.material instanceof THREE.Material) {
                  node.material.transparent = true;
                  node.material.opacity = 0.85;
                  node.material.depthWrite = false; // Allow seeing through the finish
                  node.material.depthTest = true;
                }
              }
            });
            ringGroup.add(gltf.scene);
            return gltf;
          }));
        }

        // If no models to load, clear loading state
        if (promises.length === 0) {
          console.log('[RingPreview] No models to load');
          setIsLoading(false);
          return;
        }

        // Load all models in parallel
        await Promise.all(promises);
        console.log('[RingPreview] All models loaded successfully');
        setIsLoading(false);
      } catch (error) {
        console.error('[RingPreview] Error loading models:', error);
        setError(error instanceof Error ? error.message : 'Error loading 3D models');
        setIsLoading(false);
      }
    };

    loadAllModels();

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
      
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            } else if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            }
          }
        });
        sceneRef.current.clear();
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [coreUrl, inlayUrls, finishUrl, width, height]);

  if (error) {
    return (
      <Box
        width={`${width}px`}
        height={`${height}px`}
        display="flex"
        alignItems="center"
        justifyContent="center"
        backgroundColor="gray.100"
        borderRadius="md"
      >
        <Text color="red.500" textAlign="center">
          Error: {error}
        </Text>
      </Box>
    );
  }

  // Add method to export the entire scene as GLB
  const exportScene = async () => {
    if (!sceneRef.current) {
      throw new Error('Scene not initialized');
    }

    console.log('[RingPreview] Starting scene export...');
    const exporter = new GLTFExporter();

    return new Promise((resolve, reject) => {
      const exportOptions = {
        binary: true,
        embedImages: true,
        includeCustomExtensions: true,
      };

      // We know scene is not null here because of the check above
      const scene = sceneRef.current as THREE.Scene;
      exporter.parse(
        scene,
        (gltf) => {
          resolve(gltf as ArrayBuffer);
        },
        (error) => {
          console.error('[RingPreview] Export error:', error);
          reject(error);
        },
        exportOptions
      );
    });
  };

  // Expose the exportScene method to the parent component
  useEffect(() => {
    const containerElement = document.querySelector('.ring-preview-container');
    if (containerElement) {
      (containerElement as any).__ringPreview = {
        exportScene,
      };
    }
  }, []);

  return (
    <Box
      width={`${width}px`}
      height={`${height}px`}
      position="relative"
      className="ring-preview-container"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          outline: 'none'
        }}
      />
      {isLoading && (
        <VStack
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          justify="center"
          align="center"
          backgroundColor="rgba(0, 0, 0, 0.1)"
          borderRadius="md"
        >
          <Spinner size="xl" color="blue.500" />
          <Text>Loading 3D Model...</Text>
        </VStack>
      )}
    </Box>
  );
};

export default RingPreview;