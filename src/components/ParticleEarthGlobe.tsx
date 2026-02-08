'use client';

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { Market, isMarketOpen } from '@/lib/marketData';

// Convert lat/lng to 3D position
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

// Earth with real texture
function Earth() {
    const earthRef = useRef<THREE.Mesh>(null);

    // Load high-quality Earth texture
    const earthMap = useTexture('https://unpkg.com/three-globe@2.31.0/example/img/earth-dark.jpg');

    useFrame(() => {
        if (earthRef.current) {
            earthRef.current.rotation.y += 0.001;
        }
    });

    return (
        <mesh ref={earthRef}>
            <sphereGeometry args={[2, 64, 64]} />
            <meshStandardMaterial
                map={earthMap}
                metalness={0.1}
                roughness={0.8}
            />
        </mesh>
    );
}

// Market zone indicator - glowing ring on the globe
function MarketZone({ market, refreshKey }: { market: Market; refreshKey: number }) {
    const ringRef = useRef<THREE.Mesh>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setIsOpen(isMarketOpen(market));
    }, [market, refreshKey]);

    const position = latLngToVector3(market.latitude, market.longitude, 2.02);
    const color = isOpen ? '#00ff88' : '#ff4466';

    // Calculate rotation to face outward from globe center
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    useFrame((state) => {
        if (ringRef.current) {
            // Subtle pulse
            const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
            ringRef.current.scale.setScalar(scale);
        }
    });

    return (
        <group position={position} quaternion={quaternion}>
            {/* Outer glow ring */}
            <mesh ref={ringRef}>
                <ringGeometry args={[0.15, 0.25, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
            {/* Center dot */}
            <mesh>
                <circleGeometry args={[0.08, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.9} />
            </mesh>
            {/* Glow effect */}
            <mesh>
                <circleGeometry args={[0.35, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.15} />
            </mesh>
        </group>
    );
}

// Atmosphere glow
function Atmosphere() {
    return (
        <mesh scale={[1.15, 1.15, 1.15]}>
            <sphereGeometry args={[2, 64, 64]} />
            <meshBasicMaterial
                color="#4da6ff"
                transparent
                opacity={0.08}
                side={THREE.BackSide}
            />
        </mesh>
    );
}

// Loading fallback
function LoadingGlobe() {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(() => { if (ref.current) ref.current.rotation.y += 0.01; });
    return (
        <mesh ref={ref}>
            <sphereGeometry args={[2, 32, 32]} />
            <meshBasicMaterial color="#1a2a3a" wireframe />
        </mesh>
    );
}

// Scene with rotating group
function Scene({ markets, refreshKey }: { markets: Market[]; refreshKey: number }) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.001;
        }
    });

    return (
        <group ref={groupRef}>
            <Earth />
            <Atmosphere />
            {markets.map((market) => (
                <MarketZone key={market.id} market={market} refreshKey={refreshKey} />
            ))}
        </group>
    );
}

export default function ParticleEarthGlobe({ markets }: { markets: Market[] }) {
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setRefreshKey(k => k + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.3} />
                <directionalLight position={[5, 3, 5]} intensity={1} />
                <directionalLight position={[-5, -2, -5]} intensity={0.3} color="#4da6ff" />

                <React.Suspense fallback={<LoadingGlobe />}>
                    <Scene markets={markets} refreshKey={refreshKey} />
                </React.Suspense>

                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    autoRotate={false}
                    enableDamping
                    dampingFactor={0.05}
                    minPolarAngle={Math.PI * 0.2}
                    maxPolarAngle={Math.PI * 0.8}
                />
            </Canvas>
        </div>
    );
}

import React from 'react';
