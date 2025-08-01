import { createReviveSdk, ss58ToEthereum, type ReviveSdkTypedApi } from "@polkadot-api/sdk-ink"
import { useChainId, useTypedApi } from "@reactive-dot/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useSignerAndAddress } from "@/hooks/use-signer-and-address"
import { erc20 } from "@/lib/inkathon/deployments"
import { CardSkeleton } from "../layout/skeletons"
import { Button } from "../ui/button-extended"
import { Card, CardHeader, CardTitle } from "../ui/card"
import { Table, TableBody, TableCell, TableRow } from "../ui/table"
import { Binary, FixedSizeArray } from "polkadot-api"

export function ContractCard() {
  // State
  const [queryIsLoading, setQueryIsLoading] = useState(true)
  const [erc20TotalSupply, setErc20TotalSupply] = useState<FixedSizeArray<4, bigint>>()
  const [accountErc20MyBalance, setAccountErc20MyBalance] = useState<FixedSizeArray<4, bigint>>()
  const [accountErc20InputBalance, setAccountErc20InputBalance] = useState<FixedSizeArray<4, bigint>>()
  const [inputAddress, setInputAddress] = useState<string>("0x41dccbd49b26c50d34355ed86ff0fa9e489d1e01") // BOB by default

  // Hooks
  const api = useTypedApi()
  const chain = useChainId()
  const { signer, signerAddress } = useSignerAndAddress()

  /**
   * Query contract data (total supply, my balance, and input address balance)
   */
  const queryContract = useCallback(async () => {
    setQueryIsLoading(true)
    try {
      if (!api || !chain) return

      // Create SDK & contract instance
      const sdk = createReviveSdk(api as ReviveSdkTypedApi, erc20.contract)
      const contract = sdk.getContract(erc20.evmAddresses[chain])

      // Query total supply from storage
      const storageResult = await contract.getStorage().getRoot()
      const total_supply = storageResult.success ? storageResult.value.total_supply : undefined
      setErc20TotalSupply(total_supply)

      // Check if account is mapped before querying balances
      if (!api || !chain || !signer) return
      const isMapped = await sdk.addressIsMapped(signerAddress)
      if (!isMapped) {
        toast.error("Account not mapped. Please map your account first.")
        return
      }

      // Query my balance
      const resultQueryMyBalance = await contract.query("balance_of", { 
        origin: signerAddress, 
        data: {
          owner: ss58ToEthereum(signerAddress)
        }
      })
      const mybalance = resultQueryMyBalance.success ? resultQueryMyBalance.value.response : undefined
      setAccountErc20MyBalance(mybalance)

      // Query input address balance
      const resultQueryInputAddressBalance = await contract.query("balance_of", { 
        origin: signerAddress, 
        data: {
          owner: Binary.fromHex(inputAddress)
        }
      })
      const balance = resultQueryInputAddressBalance.success ? resultQueryInputAddressBalance.value.response : undefined
      setAccountErc20InputBalance(balance)
    } catch (error) {
      console.error(error)
    } finally {
      setQueryIsLoading(false)
    }
  }, [api, chain, inputAddress, signer, signerAddress])

  useEffect(() => {
    queryContract()
  }, [queryContract])

  /**
   * Transfer 1 ERC20 token to the input address
   */
  const transfer = useCallback(async () => {
    if (!api || !chain || !signer || !inputAddress) return

    const sdk = createReviveSdk(api as ReviveSdkTypedApi, erc20.contract)
    const contract = sdk.getContract(erc20.evmAddresses[chain])

    // Check if account is mapped
    const isMapped = await sdk.addressIsMapped(signerAddress)
    if (!isMapped) {
      toast.error("Account not mapped. Please map your account first.")
      return
    }

    // Send transfer transaction
    const tx = contract
      .send("transfer", { 
        origin: signerAddress, 
        data: {
          to: Binary.fromHex(inputAddress),
          value: [1n, 0n, 0n, 0n] // Transfer 1 token
        }
      })
      .signAndSubmit(signer)
      .then((tx) => {
        queryContract() // Refresh data after transfer
        if (!tx.ok) throw new Error("Failed to send transaction", { cause: tx.dispatchError })
      })

    toast.promise(tx, {
      loading: "Transferring token...",
      success: "Token transferred successfully",
      error: "Failed to transfer token",
    })
  }, [signer, api, chain, inputAddress, queryContract])

  if (queryIsLoading) return <CardSkeleton />

  return (
    <Card className="inkathon-card">
      <CardHeader>
        <CardTitle>ERC20 Contract</CardTitle>
      </CardHeader>
      
      <Table className="inkathon-card-table">
        <TableBody>
          <TableRow>
            <TableCell>Total Supply</TableCell>
            <TableCell>{erc20TotalSupply}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>My Balance</TableCell>
            <TableCell>{accountErc20MyBalance}</TableCell>
          </TableRow>
          {inputAddress && (
            <TableRow>
              <TableCell>Balance of {inputAddress}</TableCell>
              <TableCell>{accountErc20InputBalance}</TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell>Contract Address</TableCell>
            <TableCell>{erc20.evmAddresses[chain]}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Enter address to transfer 1 ERC20 token"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                setInputAddress(inputAddress)
              }
            }}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          />
          <Button
            onClick={transfer}
            size="sm"
            variant="default"
          >
            Transfer
          </Button>
        </div>
      </div>
    </Card>
  )
}

