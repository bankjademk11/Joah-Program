import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RotateCw, Trash2, MapPin, MousePointer2, Move, Box, Check } from 'lucide-react';

const DemoPlan = () => {
    const mountRef = useRef(null);
    const labelsRef = useRef(null);
    
    // UI States
    const [currentMode, setCurrentMode] = useState('idle'); // 'idle', 'shelf_black', 'shelf_warehouse', 'tag', 'move'
    const [hasSelection, setHasSelection] = useState(false);
    const [labels, setLabels] = useState([]);
    const [statusMessage, setStatusMessage] = useState('Select a tool to begin.');
    
    // Three.js instances mapped to refs so event listeners can access them
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    
    const floorRef = useRef(null);
    const placeableObjectsRef = useRef([]);
    const ghostObjectRef = useRef(null);
    const selectedObjectRef = useRef(null);
    const selectionBoxRef = useRef(null);
    
    // Snapping Grid Indicator (Sims Style)
    const gridHighlightRef = useRef(null);

    // --- Helper to create Shelf (Black Gondola) ---
    const createBlackShelf = (isGhost = false) => {
        const group = new THREE.Group();
        const opacity = isGhost ? 0.6 : 1.0;
        const matBlack = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, transparent: isGhost, opacity });
        const matSilver = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3, transparent: isGhost, opacity });

        const width = 2.0; const depth = 0.8; const height = 2.2;

        const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), matBlack);
        base.position.y = 0.1;
        base.castShadow = !isGhost; base.receiveShadow = !isGhost;
        group.add(base);

        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(width, height - 0.2, 0.05), matBlack);
        backPanel.position.set(0, height/2 + 0.1, -depth/2 + 0.025);
        backPanel.castShadow = !isGhost;
        group.add(backPanel);

        for(let i = 1; i <= 3; i++) {
            const shelfY = 0.5 + (i * 0.4);
            const shelfDepth = depth - 0.2;
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, shelfDepth), matBlack);
            shelf.position.set(0, shelfY, -depth/2 + shelfDepth/2 + 0.05);
            shelf.castShadow = !isGhost;
            group.add(shelf);
            
            const lip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.02), matSilver);
            lip.position.set(0, shelfY, shelf.position.z + shelfDepth/2);
            group.add(lip);
        }

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshBasicMaterial({visible: false}));
        hitBox.position.set(0, height/2, 0);
        hitBox.userData.isHitBox = true;
        group.add(hitBox);

        group.userData = { type: 'shelf_black', isSelectable: true };
        return group;
    };

    // --- Helper to create Warehouse Rack ---
    const createWarehouseRack = (isGhost = false) => {
        const group = new THREE.Group();
        const opacity = isGhost ? 0.6 : 1.0;
        const matBlue = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, transparent: isGhost, opacity, roughness: 0.5 });
        const matOrange = new THREE.MeshStandardMaterial({ color: 0xea580c, transparent: isGhost, opacity, roughness: 0.5 });
        const matWood = new THREE.MeshStandardMaterial({ color: 0xd1d5db, transparent: isGhost, opacity });

        const width = 2.5; const depth = 0.8; const height = 2.5;
        const postThickness = 0.08; const beamThickness = 0.1;

        const postGeo = new THREE.BoxGeometry(postThickness, height, postThickness);
        const positions = [[-width/2, depth/2], [width/2, depth/2], [-width/2, -depth/2], [width/2, -depth/2]];
        
        positions.forEach(pos => {
            const post = new THREE.Mesh(postGeo, matBlue);
            post.position.set(pos[0], height/2, pos[1]);
            post.castShadow = !isGhost;
            group.add(post);
        });

        const beamGeoX = new THREE.BoxGeometry(width, beamThickness, 0.05);
        const beamGeoZ = new THREE.BoxGeometry(0.05, beamThickness, depth);
        const shelfGeo = new THREE.BoxGeometry(width - postThickness, 0.02, depth - postThickness);

        for(let i = 0; i < 4; i++) {
            const yLevel = 0.3 + (i * 0.65);
            const beamF = new THREE.Mesh(beamGeoX, matOrange); beamF.position.set(0, yLevel, depth/2); beamF.castShadow = !isGhost; group.add(beamF);
            const beamB = new THREE.Mesh(beamGeoX, matOrange); beamB.position.set(0, yLevel, -depth/2); beamB.castShadow = !isGhost; group.add(beamB);
            const beamL = new THREE.Mesh(beamGeoZ, matOrange); beamL.position.set(-width/2, yLevel, 0); group.add(beamL);
            const beamR = new THREE.Mesh(beamGeoZ, matOrange); beamR.position.set(width/2, yLevel, 0); group.add(beamR);
            const shelf = new THREE.Mesh(shelfGeo, matWood); shelf.position.set(0, yLevel + beamThickness/2, 0); shelf.receiveShadow = !isGhost; group.add(shelf);
        }

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, height, depth + 0.1), new THREE.MeshBasicMaterial({visible: false}));
        hitBox.position.set(0, height/2, 0); hitBox.userData.isHitBox = true; group.add(hitBox);

        group.userData = { type: 'shelf_warehouse', isSelectable: true };
        return group;
    };

    // --- Helper to create Tag ---
    const createTagMarker = (isGhost = false) => {
        const group = new THREE.Group();
        const opacity = isGhost ? 0.6 : 1.0;
        const matRed = new THREE.MeshStandardMaterial({ color: 0xef4444, transparent: isGhost, opacity, emissive: 0xef4444, emissiveIntensity: 0.2 });
        
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 16), matRed);
        cone.rotation.x = Math.PI; cone.position.y = 0.2; cone.castShadow = !isGhost; group.add(cone);

        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), matRed);
        sphere.position.y = 0.4; sphere.castShadow = !isGhost; group.add(sphere);

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), new THREE.MeshBasicMaterial({visible: false}));
        hitBox.position.y = 0.35; hitBox.userData.isHitBox = true; group.add(hitBox);

        group.userData = { type: 'tag_marker', isSelectable: true };
        return group;
    };

    // Initialize Three.js Scene
    useEffect(() => {
        if (!mountRef.current) return;

        // Cleanup any previous instances
        if (rendererRef.current) {
            mountRef.current.removeChild(rendererRef.current.domElement);
            rendererRef.current.dispose();
        }

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0xdbeafe); // Soft blue sky
        scene.fog = new THREE.Fog(0xdbeafe, 15, 60);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        cameraRef.current = camera;
        camera.position.set(0, 12, 18);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = 2;
        controls.maxDistance = 40;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(15, 25, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        dirLight.shadow.bias = -0.0005;
        scene.add(dirLight);

        // Floor (Subtle grid texture)
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0xf3f4f6, 
            roughness: 0.9, 
            metalness: 0.1 
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        floorRef.current = floor;

        // Better Grid
        const gridHelper = new THREE.GridHelper(100, 100, 0x94a3b8, 0xe2e8f0);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);

        // Sims-style Placement Highlight
        const highlightGeo = new THREE.PlaneGeometry(1, 1);
        const highlightMat = new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const highlight = new THREE.Mesh(highlightGeo, highlightMat);
        highlight.rotation.x = -Math.PI / 2;
        highlight.position.y = 0.02;
        highlight.visible = false;
        scene.add(highlight);
        gridHighlightRef.current = highlight;

        // Selection Box (Yellow outline)
        const selectionBox = new THREE.BoxHelper(floor, 0xfacc15);
        selectionBox.visible = false;
        // Make it slightly thicker by adding line width (requires WebGL 2, but standard looks okay)
        scene.add(selectionBox);
        selectionBoxRef.current = selectionBox;

        // Animation Loop
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();

            if (selectionBoxRef.current && selectionBoxRef.current.visible && selectedObjectRef.current) {
                selectionBoxRef.current.update();
            }

            // Update 2D HTML Labels Position smoothly
            setLabels(prev => {
                if(prev.length === 0) return prev;
                const widthHalf = 0.5 * window.innerWidth;
                const heightHalf = 0.5 * window.innerHeight;
                return prev.map(tag => {
                    if (!tag.mesh) return tag;
                    const pos = new THREE.Vector3();
                    pos.setFromMatrixPosition(tag.mesh.matrixWorld);
                    pos.y += 0.6; // Offset above pin
                    pos.project(camera);
                    
                    const isVisible = pos.z <= 1;
                    const x = (pos.x * widthHalf) + widthHalf;
                    const y = -(pos.y * heightHalf) + heightHalf;
                    
                    return { ...tag, x, y, visible: isVisible, zIndex: Math.round((1 - pos.z) * 100) };
                });
            });

            renderer.render(scene, camera);
        };
        animate();

        // Resize Handler
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, []);

    // Change Mode Effect
    useEffect(() => {
        if (!sceneRef.current) return;
        
        if (currentMode !== 'move') {
            deselect();
        }
        
        if (ghostObjectRef.current) {
            sceneRef.current.remove(ghostObjectRef.current);
            ghostObjectRef.current = null;
        }

        if (gridHighlightRef.current) {
            gridHighlightRef.current.visible = false;
        }

        if (currentMode === 'idle' || currentMode === 'move') {
            if(controlsRef.current) controlsRef.current.enabled = true;
            if (currentMode === 'idle') setStatusMessage('Select a tool to begin.');
            if (currentMode === 'move') setStatusMessage('Move Mode: Click floor to move selected object.');
            return;
        }

        let ghost;
        if (currentMode === 'shelf_black') {
            ghost = createBlackShelf(true);
            if(gridHighlightRef.current) gridHighlightRef.current.scale.set(2, 0.8, 1);
            setStatusMessage('Placing Gondola Shelf. [ESC] to cancel.');
        } else if (currentMode === 'shelf_warehouse') {
            ghost = createWarehouseRack(true);
            if(gridHighlightRef.current) gridHighlightRef.current.scale.set(2.5, 0.8, 1);
            setStatusMessage('Placing Warehouse Rack. [ESC] to cancel.');
        } else if (currentMode === 'tag') {
            ghost = createTagMarker(true);
            if(gridHighlightRef.current) gridHighlightRef.current.scale.set(1, 1, 1);
            setStatusMessage('Placing Area Tag. [ESC] to cancel.');
        }

        if (ghost) {
            sceneRef.current.add(ghost);
            ghost.visible = false;
            ghostObjectRef.current = ghost;
        }
    }, [currentMode]);

    // Handle Selection & Deselection
    const selectObject = (obj) => {
        selectedObjectRef.current = obj;
        if (selectionBoxRef.current) {
            selectionBoxRef.current.setFromObject(obj);
            selectionBoxRef.current.visible = true;
        }
        setHasSelection(true);
    };

    const deselect = () => {
        selectedObjectRef.current = null;
        if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
        setHasSelection(false);
        if (currentMode === 'move') setCurrentMode('idle');
    };

    // Actions
    const handleRotate = () => {
        if (selectedObjectRef.current && selectedObjectRef.current.userData.type !== 'tag_marker') {
            // Animate rotation slightly for better feel (Sims like)
            selectedObjectRef.current.rotation.y -= Math.PI / 2;
            if (selectionBoxRef.current) selectionBoxRef.current.setFromObject(selectedObjectRef.current);
            
            // Adjust highlight if placing
            if (gridHighlightRef.current && ghostObjectRef.current) {
               // swap scale x/y
               const sc = gridHighlightRef.current.scale;
               gridHighlightRef.current.scale.set(sc.y, sc.x, 1);
            }
        }
    };

    const handleDelete = () => {
        if (selectedObjectRef.current) {
            sceneRef.current.remove(selectedObjectRef.current);
            const index = placeableObjectsRef.current.indexOf(selectedObjectRef.current);
            if (index > -1) placeableObjectsRef.current.splice(index, 1);

            if (selectedObjectRef.current.userData.type === 'tag_marker') {
                const meshId = selectedObjectRef.current.uuid;
                setLabels(prev => prev.filter(t => t.mesh.uuid !== meshId));
            }
            deselect();
        }
    };

    // Mouse & Keyboard Handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setCurrentMode('idle');
            if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
            if (e.key === 'r' || e.key === 'R') {
                if (currentMode !== 'idle' && ghostObjectRef.current) {
                    ghostObjectRef.current.rotation.y -= Math.PI / 2;
                    const sc = gridHighlightRef.current.scale;
                    gridHighlightRef.current.scale.set(sc.y, sc.x, 1);
                } else {
                    handleRotate();
                }
            }
        };

        const handleMouseMove = (e) => {
            if (!cameraRef.current || !floorRef.current) return;
            mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;

            if ((currentMode !== 'idle' && currentMode !== 'move') && ghostObjectRef.current) {
                raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
                const intersects = raycasterRef.current.intersectObject(floorRef.current);
                
                if (intersects.length > 0) {
                    ghostObjectRef.current.visible = true;
                    if(gridHighlightRef.current) gridHighlightRef.current.visible = true;
                    
                    const point = intersects[0].point;
                    // Snap to grid
                    const snapX = Math.round(point.x * 2) / 2;
                    const snapZ = Math.round(point.z * 2) / 2;

                    ghostObjectRef.current.position.set(snapX, 0, snapZ);
                    if(gridHighlightRef.current) gridHighlightRef.current.position.set(snapX, 0.02, snapZ);
                    
                    // Rotate highlight to match object
                    if(gridHighlightRef.current) gridHighlightRef.current.rotation.z = -ghostObjectRef.current.rotation.y;

                } else {
                    ghostObjectRef.current.visible = false;
                    if(gridHighlightRef.current) gridHighlightRef.current.visible = false;
                }
            } else if (currentMode === 'move' && selectedObjectRef.current) {
                raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
                const intersects = raycasterRef.current.intersectObject(floorRef.current);
                if (intersects.length > 0) {
                     // Show grid highlight for move destination
                     if(gridHighlightRef.current) {
                         gridHighlightRef.current.visible = true;
                         const point = intersects[0].point;
                         const snapX = Math.round(point.x * 2) / 2;
                         const snapZ = Math.round(point.z * 2) / 2;
                         gridHighlightRef.current.position.set(snapX, 0.02, snapZ);
                         
                         // Determine scale based on selected object type
                         const type = selectedObjectRef.current.userData.type;
                         if (type === 'shelf_black') gridHighlightRef.current.scale.set(2, 0.8, 1);
                         else if (type === 'shelf_warehouse') gridHighlightRef.current.scale.set(2.5, 0.8, 1);
                         else gridHighlightRef.current.scale.set(1, 1, 1);

                         gridHighlightRef.current.rotation.z = -selectedObjectRef.current.rotation.y;
                     }
                }
            }
        };

        const handleMouseClick = (e) => {
            if (e.clientX < 320) return; // Ignore sidebar clicks
            
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

            if (currentMode === 'move' && selectedObjectRef.current) {
                // Execute move
                const intersects = raycasterRef.current.intersectObject(floorRef.current);
                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    const snapX = Math.round(point.x * 2) / 2;
                    const snapZ = Math.round(point.z * 2) / 2;
                    
                    selectedObjectRef.current.position.set(snapX, 0, snapZ);
                    if (selectionBoxRef.current) selectionBoxRef.current.setFromObject(selectedObjectRef.current);
                    
                    // Bounce animation effect
                    selectedObjectRef.current.position.y = 0.5;
                    const drop = setInterval(() => {
                        selectedObjectRef.current.position.y -= 0.1;
                        if(selectedObjectRef.current.position.y <= 0) {
                            selectedObjectRef.current.position.y = 0;
                            clearInterval(drop);
                        }
                    }, 16);

                    setCurrentMode('idle'); // Exit move mode
                }
                return;
            }

            if (currentMode !== 'idle') {
                const intersects = raycasterRef.current.intersectObject(floorRef.current);
                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    let newObj;
                    let isTag = false;

                    if (currentMode === 'shelf_black') newObj = createBlackShelf(false);
                    else if (currentMode === 'shelf_warehouse') newObj = createWarehouseRack(false);
                    else if (currentMode === 'tag') { newObj = createTagMarker(false); isTag = true; }

                    if (newObj) {
                        const snapX = Math.round(point.x * 2) / 2;
                        const snapZ = Math.round(point.z * 2) / 2;
                        newObj.position.set(snapX, 0, snapZ);
                        newObj.rotation.y = ghostObjectRef.current ? ghostObjectRef.current.rotation.y : 0;
                        
                        // Spawn animation (pop up)
                        newObj.scale.set(0,0,0);
                        sceneRef.current.add(newObj);
                        placeableObjectsRef.current.push(newObj);

                        let s = 0;
                        const grow = setInterval(() => {
                            s += 0.2;
                            if (s >= 1) {
                                newObj.scale.set(1,1,1);
                                clearInterval(grow);
                            } else {
                                newObj.scale.set(s,s,s);
                            }
                        }, 16);

                        if (isTag) {
                            setTimeout(() => {
                                const text = window.prompt("Enter Tag/Zone Name:", "Zone A");
                                if (text) {
                                    setLabels(prev => [...prev, { mesh: newObj, text, id: newObj.uuid, x: 0, y: 0, visible: false, zIndex: 0 }]);
                                } else {
                                    sceneRef.current.remove(newObj);
                                    placeableObjectsRef.current.pop();
                                }
                            }, 50);
                        } else {
                            selectObject(newObj);
                        }
                        
                        // Keep mode active so they can place multiple! (Sims style)
                        // If they want to stop, they press ESC
                    }
                }
            } else {
                // Select Mode
                const hitBoxes = placeableObjectsRef.current.map(g => g.children.find(c => c.userData.isHitBox)).filter(Boolean);
                const intersects = raycasterRef.current.intersectObjects(hitBoxes);
                if (intersects.length > 0) {
                    selectObject(intersects[0].object.parent);
                } else {
                    deselect();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleMouseClick);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleMouseClick);
        };
    }, [currentMode]);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans">
            {/* 3D Canvas Mount Point */}
            <div ref={mountRef} className="absolute inset-0 z-0" />
            
            {/* HTML Tags Overlay */}
            <div ref={labelsRef} className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                {labels.map(tag => (
                    <div 
                        key={tag.id}
                        className="absolute bg-white/95 border-[3px] border-indigo-500 text-slate-800 px-3 py-1.5 rounded-full text-xs font-black shadow-xl transition-all duration-100 whitespace-nowrap flex items-center gap-1"
                        style={{
                            left: `${tag.x}px`,
                            top: `${tag.y}px`,
                            transform: `translate(-50%, -100%) scale(${tag.visible ? 1 : 0.5})`,
                            marginTop: '-15px',
                            opacity: tag.visible ? 1 : 0,
                            zIndex: tag.zIndex
                        }}
                    >
                        <MapPin size={14} className="text-indigo-500" />
                        {tag.text}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-transparent border-t-indigo-500"></div>
                    </div>
                ))}
            </div>

            {/* UI Layer */}
            <div className="absolute inset-0 z-20 pointer-events-none flex">
                {/* Sidebar */}
                <div className="pointer-events-auto w-80 bg-white/90 backdrop-blur-md shadow-2xl h-full flex flex-col border-r border-slate-200">
                    <div className="p-6 bg-gradient-to-r from-indigo-900 to-slate-800 text-white shadow-md relative overflow-hidden">
                        <div className="relative z-10">
                            <h1 className="text-2xl font-black mb-1 flex items-center gap-2"><Box size={24} className="text-indigo-400" /> Builder Mode</h1>
                            <p className="text-xs text-indigo-200 font-medium">Design your warehouse layout</p>
                        </div>
                        <div className="absolute -bottom-10 -right-10 opacity-20"><Box size={100} /></div>
                    </div>

                    <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Build Catalog</h2>
                        
                        <div className="space-y-3">
                            <button onClick={() => setCurrentMode('shelf_black')} className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center gap-4 group hover:shadow-md ${currentMode === 'shelf_black' ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-100 hover:border-indigo-300 hover:bg-slate-50'}`}>
                                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shadow-inner group-hover:rotate-3 transition-transform">
                                    <div className="w-6 h-1 bg-slate-500 mt-2"></div>
                                </div>
                                <div>
                                    <div className="font-black text-slate-800 group-hover:text-indigo-700">Store Shelf</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Gondola Type</div>
                                </div>
                            </button>

                            <button onClick={() => setCurrentMode('shelf_warehouse')} className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center gap-4 group hover:shadow-md ${currentMode === 'shelf_warehouse' ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-100 hover:border-indigo-300 hover:bg-slate-50'}`}>
                                <div className="w-12 h-12 bg-blue-100 border-2 border-blue-500 rounded-xl flex flex-col justify-between p-1.5 shadow-inner group-hover:-rotate-3 transition-transform">
                                    <div className="w-full h-1.5 bg-orange-500 rounded-full"></div>
                                    <div className="w-full h-1.5 bg-orange-500 rounded-full"></div>
                                </div>
                                <div>
                                    <div className="font-black text-slate-800 group-hover:text-indigo-700">Pallet Rack</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Heavy Duty</div>
                                </div>
                            </button>

                            <button onClick={() => setCurrentMode('tag')} className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center gap-4 group hover:shadow-md ${currentMode === 'tag' ? 'border-red-500 bg-red-50 scale-[1.02]' : 'border-slate-100 hover:border-red-300 hover:bg-slate-50'}`}>
                                <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-rose-600 rounded-full flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                                    <MapPin size={20} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div className="font-black text-slate-800 group-hover:text-red-700">Zone Marker</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Interactive Label</div>
                                </div>
                            </button>
                        </div>

                        <div className="mt-8">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Selected Object</h2>
                            {hasSelection ? (
                                <div className="space-y-2 p-4 bg-slate-800 rounded-2xl border border-slate-700 shadow-lg animate-in fade-in zoom-in-95">
                                    <p className="text-[10px] text-emerald-400 mb-3 font-black uppercase tracking-widest flex items-center gap-1.5"><Check size={14}/> Ready to modify</p>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setCurrentMode('move')} className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl shadow-sm border transition-colors ${currentMode === 'move' ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'}`}>
                                            <Move size={18} />
                                            <span className="text-xs font-bold">Move</span>
                                        </button>
                                        <button onClick={handleRotate} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-700 text-slate-200 text-sm rounded-xl shadow-sm border border-slate-600 hover:bg-slate-600 transition-colors">
                                            <RotateCw size={18} />
                                            <span className="text-xs font-bold">Rotate</span>
                                        </button>
                                    </div>
                                    <button onClick={handleDelete} className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-rose-500/20 text-rose-400 text-sm rounded-xl border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all font-bold">
                                        <Trash2 size={16} /> Delete Object
                                    </button>
                                    <button onClick={deselect} className="w-full py-2 text-slate-400 hover:text-white text-xs font-medium transition-colors mt-1">
                                        Deselect [ESC]
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-6 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
                                    <MousePointer2 size={24} className="opacity-50" />
                                    <span className="text-xs font-medium text-center">Click any placed object<br/>to edit it.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Controls Helper */}
                    <div className="p-4 bg-slate-900 text-xs text-slate-400 font-medium space-y-2 border-t border-slate-800/50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center gap-2"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">L-Click</kbd> <span>Select / Place</span></div>
                        <div className="flex items-center gap-2"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">R-Click</kbd> <span>Pan Camera</span></div>
                        <div className="flex items-center gap-2"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">R</kbd> <span>Rotate Item</span></div>
                    </div>
                </div>

                {/* Status Bar Indicator */}
                <div className="flex-1 relative">
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 pointer-events-none flex items-center gap-3">
                        <div className="bg-white/95 backdrop-blur shadow-lg border border-slate-200 text-slate-800 px-6 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all duration-300 flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${currentMode === 'idle' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></div>
                            {statusMessage}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoPlan;