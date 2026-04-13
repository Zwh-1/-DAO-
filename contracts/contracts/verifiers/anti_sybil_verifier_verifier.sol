// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 16400614238872513725653396717532467268131302590612653145629085870827246050626;
    uint256 constant alphay  = 12890751192754929457673321955459276664086288382354558418099575921437216102053;
    uint256 constant betax1  = 10401868079474539757295538748328843113030028636927924103350547133225902659651;
    uint256 constant betax2  = 2669713321548010870453327885291144603499216124295701475608885216765917856076;
    uint256 constant betay1  = 3379118402561145912676644783999387266170606296773395710942802409103518050075;
    uint256 constant betay2  = 3501330501422530266964781397326212389377087696402108994204115594149263833707;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 3061369820600800006901544359854721653933833021370138803665319915093789623980;
    uint256 constant deltax2 = 14692232833007243617179740648305428768864323436810373911089888802850222095796;
    uint256 constant deltay1 = 4133927419268878925019607060516439220500679463608383318111111323245820095649;
    uint256 constant deltay2 = 18011269616431328765966353731546716617814174698711794811821201176067767092076;

    
    uint256 constant IC0x = 63325677059802659492584325943968076635017366671877488749376335143223711681;
    uint256 constant IC0y = 1497368791987660252141387786772306296705444067800294747014871972372735472496;
    
    uint256 constant IC1x = 945202599538390502949662356289282367767198090724131186396294396841101515895;
    uint256 constant IC1y = 15136074968664188432651460620140125286223681981199633406956632405567181548879;
    
    uint256 constant IC2x = 1198367634711132776841680657291644928843449937148216978342464051095196801501;
    uint256 constant IC2y = 10254518385432499705552840782361336552975869580554536119236670504140563200625;
    
    uint256 constant IC3x = 13052671897401546700444899305128159890048136620667691107657513369572491216636;
    uint256 constant IC3y = 294815788011942591674496837356234976023605285696936384095220199107117799991;
    
    uint256 constant IC4x = 19868016452593627484564198060349961662400805380296343536058997847708725776870;
    uint256 constant IC4y = 11567226142221151021762333947038131064471098702058268172365385334770186895270;
    
    uint256 constant IC5x = 11014809794812825628859863523663874701816145856824857336395453539936814251804;
    uint256 constant IC5y = 17146114667899170112482201017490437276542897105104158671277199375472357356017;
    
    uint256 constant IC6x = 9639597975886522285589500086412145127216351373677775476543769978023804563429;
    uint256 constant IC6y = 11473065373683992468901310577346178495097130223242017755030909769225797599900;
    
    uint256 constant IC7x = 20499757756336749554134485255696624570963314039691324818086534021571524559763;
    uint256 constant IC7y = 8766498054550443821227960524922036397242354383324148791398444330414136592109;
    
    uint256 constant IC8x = 5542217427802754940686209865340058659988874181254795709567481247997237705975;
    uint256 constant IC8y = 3071704442191041648110047750668858385231451078476649511466355402351595316139;
    
    uint256 constant IC9x = 13433772288991885794586909422863877935489151606414257605213262878039199874731;
    uint256 constant IC9y = 6184119561411951856809545774073807073373430277431494237322266009078960997575;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
