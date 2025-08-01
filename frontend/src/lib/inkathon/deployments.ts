import {
  evmAddress as evmAddressPassethub,
  ss58Address as ss58AddressPassethub,
} from "@inkathon/contracts/deployments/erc20/passethub"

import { contracts } from "@polkadot-api/descriptors"


export const erc20 = {
  contract: contracts.erc20,
  evmAddresses: {
    passethub: evmAddressPassethub,
  },
  ss58Addresses: {
    passethub: ss58AddressPassethub,
  },
}
