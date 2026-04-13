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
    uint256 constant alphax  = 16791243011151284095340501205254960997315767327832600772781878248449491810082;
    uint256 constant alphay  = 7885291576755738952926708084028680706164523652140761504704765696386819455761;
    uint256 constant betax1  = 16571034661562950620747610038843348140234310438975195588044790481117888229552;
    uint256 constant betax2  = 5965496649389973183610515531430971152627024862262608556514907872143651088079;
    uint256 constant betay1  = 21708670842193342275390028686046046917839736693159726455338741740098537222248;
    uint256 constant betay2  = 18860993791170878306215159804492443364215099268925981657290010868637449291416;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 13682865666088672462958027027416308071816072888531934401039690717816121130405;
    uint256 constant deltax2 = 14660855828017934016952463518887193645266440207769871896702106970298986817742;
    uint256 constant deltay1 = 15294624024492250449285165042556264979995220605349332521299580421836860722333;
    uint256 constant deltay2 = 21306034014754695810347758541769683875942187243598737135079359090869366871550;

    
    uint256 constant IC0x = 5253076344436249246038888195493063960498376489959567352623031746613562501138;
    uint256 constant IC0y = 3609597634452004082215778000975091193954699781901425408276099306670553072871;
    
    uint256 constant IC1x = 3383370633505511237246744231972414574887862201834870088388092982120743563192;
    uint256 constant IC1y = 9201889238263796640439379400646668182283708205810717187545925711309795158458;
    
    uint256 constant IC2x = 1460966899040500730723886295386700834239031136419692451182082531971267436248;
    uint256 constant IC2y = 20400919909966768840046550623971910569360100733344535895074309801207750398537;
    
    uint256 constant IC3x = 21093248251950237964209577246211655330951951674654736710368653201239244440431;
    uint256 constant IC3y = 8631325282514189268695522953042983168557055613160580924304806475095432700273;
    
    uint256 constant IC4x = 11678690074637518535283357234542544380155564997405181376923580301102480716712;
    uint256 constant IC4y = 6428504316773367634326482325341830817816088294394351600459139226611394656716;
    
    uint256 constant IC5x = 5089056406232998769769706596144645507521952288365135915362614072268171235067;
    uint256 constant IC5y = 14830932015837186131180474340493684468539748692613169572426755641909266078495;
    
    uint256 constant IC6x = 1233494385130175265884540943463558111615689538582896185749133136786353207936;
    uint256 constant IC6y = 14015089210010965343185161485374118076941256569847495252083378611368400614380;
    
    uint256 constant IC7x = 17964238999772678325870499622857359231970510886092520699464191967447128706403;
    uint256 constant IC7y = 15507477776275646458420496482508397435508798582776069900028139113063819575259;
    
    uint256 constant IC8x = 14638286942449485680052825612841559512242530182623645838180539457809366947557;
    uint256 constant IC8y = 11328381897645898625208799825408857692302479648593907750088617608781657822214;
    
    uint256 constant IC9x = 10797975336430961859641584944813539233274628412443501195076375784341797098293;
    uint256 constant IC9y = 2554833607718345755378230380720806613711740439632147475661390958010791126587;
    
    uint256 constant IC10x = 13702633695201835936032242106858435850182359379590733866483108923066797170117;
    uint256 constant IC10y = 6637072347716352923188130094004913744150260903674645120693059294506700293043;
    
    uint256 constant IC11x = 14661382982728151761164508673933294424786509130600837020916715497682437271781;
    uint256 constant IC11y = 2286860531954627309633639346691533822259832491079288558042885183218787237733;
    
    uint256 constant IC12x = 17375988000840183294903888198680676909620789216790748151766777887471964035944;
    uint256 constant IC12y = 17044546121514175613824580456276824677754425573964691592882629771102518923611;
    
    uint256 constant IC13x = 16915488853705033172211727169634142942824832252158565301257493995480721569686;
    uint256 constant IC13y = 5184979464677903620423499644297540008099412325058926512274203166574214865092;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[13] calldata _pubSignals) public view returns (bool) {
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
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                

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
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
