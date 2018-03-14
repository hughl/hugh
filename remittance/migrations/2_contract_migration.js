var RemittanceContract = artifacts.require("./Remittance.sol");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(RemittanceContract);
};
