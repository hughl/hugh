var GameHub = artifacts.require("./GameHub.sol");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(GameHub);
};
