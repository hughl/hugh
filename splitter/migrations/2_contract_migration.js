var SplitterContract = artifacts.require("./Splitter.sol");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(SplitterContract);
};
