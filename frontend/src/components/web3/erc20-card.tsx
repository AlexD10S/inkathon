import { createReviveSdk, type ReviveSdkTypedApi } from "@polkadot-api/sdk-ink"
import { useChainId, useTypedApi } from "@reactive-dot/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useSignerAndAddress } from "@/hooks/use-signer-and-address"
import { erc20 } from "@/lib/inkathon/deployments"
import { CardSkeleton } from "../layout/skeletons"
import { Button } from "../ui/button-extended"
import { Card, CardHeader, CardTitle } from "../ui/card"
import { Table, TableBody, TableCell, TableRow } from "../ui/table"
import { Binary } from "polkadot-api"

export function Erc20Card() {
  const BOB = "0x41dccbd49b26c50d34355ed86ff0fa9e489d1e01";
  const [queryIsLoading, setQueryIsLoading] = useState(true)

  const api = useTypedApi()
  const chain = useChainId()
  const { signer, signerAddress } = useSignerAndAddress()

  /**
   * Contract Read (Query)
   */
  const [erc20State, setErc20State] = useState<any>()
  const [bobErc20Balance, setBobErc20Balance] = useState<any>()

  const queryContract = useCallback(async () => {
    setQueryIsLoading(true)
    try {
      if (!api || !chain) return

      // Create SDK & contract instance
      const sdk = createReviveSdk(api as ReviveSdkTypedApi, erc20.contract)
      const contract = sdk.getContract(erc20.evmAddresses["dev"])

      // Option 1: Query storage directly
      const storageResult = await contract.getStorage().getRoot()
      const newState = storageResult.success ? storageResult.value.total_supply : undefined;
      setErc20State(newState)

      // Option 2: Query contract
      // NOTE: Unfortunately, as `origin` is mandatory, every passed accounts needs
      //       to be mapped in an extra transaction first before it can be used for querying.
      // WORKAROUNDS: Use pre-mapped `//Alice` or use `getStorage` directly as shown above.
      //
      if (!api || !chain || !signer) return
      const isMapped = await sdk.addressIsMapped(signerAddress)
        if (!isMapped) {
        toast.error("Account not mapped. Please map your account first.")
        return
        }
      
      const result = await contract.query("balance_of", { origin: signerAddress , data: {
        owner: Binary.fromHex(BOB)
      }});
      const balance = result.success ? result.value.response : undefined
      setBobErc20Balance(balance)
    } catch (error) {
      console.error(error)
    } finally {
      setQueryIsLoading(false)
    }
  }, [api, chain])

  useEffect(() => {
    queryContract()
  }, [queryContract])


   /**
   * Contract Write (Transaction)
   */
   const transfer = useCallback(async () => {
    if (!api || !chain || !signer) return

    const sdk = createReviveSdk(api as ReviveSdkTypedApi, erc20.contract)
    const contract = sdk.getContract(erc20.evmAddresses["dev"])

    // Map account if not mapped
    const isMapped = await sdk.addressIsMapped(signerAddress)
    if (!isMapped) {
      toast.error("Account not mapped. Please map your account first.")
      return
    }

    // Send transaction
    const tx = contract
      .send("transfer", { origin: signerAddress, data: {
        to: Binary.fromHex(BOB),
        value:   [100n, 0n, 0n, 0n]
      } })
      .signAndSubmit(signer)
      .then((tx) => {
        queryContract()
        if (!tx.ok) {
            console.log(tx.dispatchError);
            throw new Error("Failed to send transaction", { cause: tx.dispatchError })
        }
      })

    toast.promise(tx, {
      loading: "Sending transaction...",
      success: "Successfully flipped",
      error: "Failed to send transaction",
    })
  }, [signer, api, chain])



  if (queryIsLoading) return <CardSkeleton />

  return (
    <Card className="inkathon-card">
      <CardHeader className="relative">
        <CardTitle>ERC20</CardTitle>
        <Button
          variant="default"
          size="sm"
          className="-top-2 absolute right-6"
          onClick={() => transfer()}
        >
          Transfer
        </Button>
      </CardHeader>

      <Table className="inkathon-card-table">
        <TableBody>
          <TableRow>
            <TableCell>Total Supply</TableCell>
            <TableCell>
              {erc20State}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell>Balance of: {BOB}</TableCell>
            <TableCell>
              {bobErc20Balance}
            </TableCell>
          </TableRow>

        </TableBody>
      </Table>
    </Card>
  )
}
