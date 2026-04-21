const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlatformRoleRegistry", function () {
  it("grantAppRole 后 hasRole 与 ethers.id(roleId) 一致", async function () {
    const [admin, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PlatformRoleRegistry");
    const reg = await Factory.deploy(admin.address);
    await reg.waitForDeployment();
    const addr = await reg.getAddress();

    const oracleHash = ethers.id("oracle");
    await reg.connect(admin).grantAppRole(oracleHash, user.address);

    expect(await reg.hasRole(oracleHash, user.address)).to.equal(true);
    expect(await reg.hasAppRole(oracleHash, user.address)).to.equal(true);

    const ac = new ethers.Interface([
      "function hasRole(bytes32 role, address account) view returns (bool)",
    ]);
    const data = ac.encodeFunctionData("hasRole", [oracleHash, user.address]);
    const raw = await ethers.provider.call({ to: addr, data });
    const [ok] = ac.decodeFunctionResult("hasRole", raw);
    expect(ok).to.equal(true);
  });
});
