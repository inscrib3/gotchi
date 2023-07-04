import { KeyPair, Noble } from "@cmdcode/crypto-utils"
import { Address, Script, Signer, Tap, Tx } from "@cmdcode/tapscript"

type RunParams = {
    log: (message: string) => void,
    address: string,
    mimetype: string,
    text: string,
    padding?: number,
    tip?: number,
    tippingAddress: string,
}

const bytesToHex = (bytes: Uint8Array) => {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
}

const privkey = bytesToHex(Noble.utils.randomPrivateKey())
let pushing = false

const isPushing = async () => {
    while (pushing) {
        await sleep(10)
    }
}

const textToHex = (text: string) => {
    var encoder = new TextEncoder().encode(text)
    return [...new Uint8Array(encoder)]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("")
}

const buf2hex = (buffer: ArrayBuffer) => {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('')
}

const getEconomyFeeRate = async () => {
    try {
        const res = await fetch(`https://mempool.space/api/v1/fees/recommended`)
        const json = await res.json()
        return json.fastestFee
    } catch (e) {
        throw new Error("Mempool connection failed for address")
    }
}

const hexToBytes = (hex: string) => {
    const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16))
    return bytes ? Uint8Array.from(bytes) : new Uint8Array()
}

const satsToBitcoin = (sats: number) => {
    if (sats >= 100000000) sats = sats * 10
    let string = String(sats).padStart(8, "0").slice(0, -9) + "." + String(sats).padStart(8, "0").slice(-9)
    if (string.substring(0, 1) == ".") string = "0" + string
    return string
}

const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const addressOnceHadMoney = async (address: string, includeMempool?: boolean) => {
    try {
        const res = await fetch("https://blockstream.info/api/address/" + address)
        const json = await res.json()
        if (json.chain_stats.tx_count > 0 || (includeMempool && json.mempool_stats.tx_count > 0)) {
            return true
        }
        return false
    } catch(e) {
        console.error(e)
        return false
    }
}

const loopTilAddressReceivesMoney = async (address: string, includeMempool?: boolean) => {
    let itReceivedMoney = false

    async function isDataSetYet(data_i_seek: boolean) {
        return new Promise(function (resolve) {
            if (!data_i_seek) {
                setTimeout(async function () {
                    try {
                        itReceivedMoney = await addressOnceHadMoney(address, includeMempool)
                    }catch(e){ }
                    let msg = await isDataSetYet(itReceivedMoney)
                    resolve(msg)
                }, 2000)
            } else {
                resolve(data_i_seek)
            }
        })
    }

    async function getTimeoutData() {
        let data_i_seek = await isDataSetYet(itReceivedMoney)
        return data_i_seek
    }

    let returnable = await getTimeoutData()
    return returnable
}

const addressReceivedMoneyInThisTx = async (address: string): Promise<[string, number, number]> => {
    let txid = ""
    let vout = 0
    let amt = 0

    try {
        const res = await fetch("https://blockstream.info/api/address/" + address + "/txs")
        const json = await res.json()
        json.forEach((tx: any) => {
            tx.vout.forEach((output: { value: number, scriptpubkey_address: string }, index: number) => {
                if (output.scriptpubkey_address == address) {
                    txid = tx.txid
                    vout = index
                    amt = output.value
                }
            })
        })
    } catch(e) {
        console.error(e)
    }

    return [txid, vout, amt]
}

const pushBTCpmt = async (rawtx: string) => {
    let txid = ''

    try {
        const res = await fetch("https://blockstream.info/api/tx", {
            method: "POST",
            body: rawtx,
        })
        txid = await res.text()
    } catch(e) {
        console.error(e)
    }

    return txid
}

export type Inscription = {
    leaf: any;
    tapkey: any;
    cblock: any;
    inscriptionAddress: any;
    txsize?: number;
    fee: any;
    script?: string[];
    script_orig: any;
}

let include_mempool = true

export const inscribe = async (log: (msg: string) => void, seckey: KeyPair, toAddress: string, inscription: Inscription, vout = 0) => {

    // we are running into an issue with 25 child transactions for unconfirmed parents.
    // so once the limit is reached, we wait for the parent tx to confirm.

    await loopTilAddressReceivesMoney(inscription.inscriptionAddress, include_mempool)
    await sleep(2000)
    
    let txinfo2 = await addressReceivedMoneyInThisTx(inscription.inscriptionAddress)

    let txid2 = txinfo2[0]
    let amt2 = txinfo2[2]

    const redeemtx = Tx.create({
        vin  : [{
            txid: txid2,
            vout: vout,
            prevout: {
                value: amt2,
                scriptPubKey: [ 'OP_1', inscription.tapkey ]
            },
        }],
        vout : [{
            value: amt2 - inscription.fee,
            scriptPubKey: [ 'OP_1', toAddress ]
        }],
    })

    const sig = await Signer.taproot.sign(seckey.raw, redeemtx, 0, {extension: inscription.leaf})
    redeemtx.vin[0].witness = [ sig.hex, inscription.script_orig, inscription.cblock ]

    console.dir(redeemtx, {depth: null})

    let rawtx2 = Tx.encode(redeemtx).hex
    let _txid2

    // since we don't know any mempool space api rate limits, we will be careful with spamming
    await isPushing()
    pushing = true
    _txid2 = await pushBTCpmt( rawtx2 )
    await sleep(1000)
    pushing = false

    if(_txid2.includes('descendant'))
    {
        include_mempool = false
        inscribe(log, seckey, toAddress, inscription, vout)
        log('Descendant transaction detected. Waiting for parent to confirm.')
        return
    }

    try {
        JSON.parse(_txid2)
    } catch (e) {
        log(`Ordinals explorer (after tx '${_txid2}' confirmation): https://ordinals.com/inscription/${_txid2}i0`)
    }
}

export const run = async (params: RunParams) => {
    let address: string

    try {
        address = Address.p2tr.decode(params.address).hex
    } catch (error) {
        throw new Error("Invalid taproot address")
    }

    try {
        const res = await fetch(`https://mempool.space/api/address/${params.address}`)
        await res.json()
    } catch (e) {
        throw new Error("Mempool connection failed for address")
    }

    const file = {
        text: JSON.stringify(params.text),
        name: textToHex(params.text),
        hex: textToHex(params.text),
        mimetype: params.mimetype,
        sha256: ''
    }

    let padding = params.padding || 546

    let seckey = new KeyPair(privkey)
    let pubkey = seckey.pub.rawX

    const ec = new TextEncoder()

    const init_script = [
        pubkey,
        'OP_CHECKSIG'
    ]

    let init_leaf = await Tap.tree.getLeaf(Script.encode(init_script))
    let [init_tapkey, init_cblock] = await Tap.getPubKey(pubkey, {target: init_leaf})

    const test_redeemtx = Tx.create({
        vin  : [{
            txid: 'a99d1112bcb35845fd44e703ef2c611f0360dd2bb28927625dbc13eab58cd968',
            vout: 0,
            prevout: {
                value: 10000,
                scriptPubKey: [ 'OP_1', init_tapkey ]
            },
        }],
        vout : [{
            value: 8000,
            scriptPubKey: [ 'OP_1', init_tapkey ]
        }],
    })

    const test_sig = await Signer.taproot.sign(seckey.raw, test_redeemtx, 0, {extension: init_leaf})
    test_redeemtx.vin[0].witness = [ test_sig.hex, init_script, init_cblock ]
    const isValid = await Signer.taproot.verify(test_redeemtx, 0, { pubkey })

    if(!isValid)
    {
        alert('Generated keys could not be validated. Please reload the app.')
        return
    }

    let total_fee = 0

    let feerate = await getEconomyFeeRate()

    let base_size = 160

        const hex = file.hex
        const data = hexToBytes(hex)
        const mimetype = ec.encode(file.mimetype)

        const script = [
            pubkey,
            'OP_CHECKSIG',
            'OP_0',
            'OP_IF',
            ec.encode('ord'),
            '01',
            mimetype,
            'OP_0',
            data,
            'OP_ENDIF'
        ]

        const script_backup = [
            '0x' + buf2hex(pubkey.buffer),
            'OP_CHECKSIG',
            'OP_0',
            'OP_IF',
            '0x' + buf2hex(ec.encode('ord')),
            '01',
            '0x' + buf2hex(mimetype),
            'OP_0',
            '0x' + buf2hex(data),
            'OP_ENDIF'
        ]

        const leaf = await Tap.tree.getLeaf(Script.encode(script))
        const [tapkey, cblock] = await Tap.getPubKey(pubkey, { target: leaf })

        let inscriptionAddress = Address.p2tr.encode(tapkey)

        let prefix = 160

        let txsize = prefix + Math.floor(data.length / 4)

        let fee = feerate * txsize
        total_fee += fee

        const inscription = 
            {
                leaf: leaf,
                tapkey: tapkey,
                cblock: cblock,
                inscriptionAddress: inscriptionAddress,
                txsize: txsize,
                fee: fee,
                script: script_backup,
                script_orig: script
            }
    

    // we are covering 2 times the same outputs, once for seeder, once for the inscribers
    let total_fees = total_fee + ( 203 * feerate ) + base_size + padding

    let fundingAddress = Address.p2tr.encode(init_tapkey)

    const tip = params.tip || 5000

    if(!isNaN(tip) && tip >= 500)
    {
        total_fees += (50 * feerate) + tip
    }

    params.log(`Please send ${satsToBitcoin(total_fees)} btc to ${fundingAddress} to fund the inscription`)

    let overhead = total_fees - total_fee - padding - tip

    if(isNaN(overhead)) {
        overhead = 0
    }

    await loopTilAddressReceivesMoney(fundingAddress, true)
    await sleep(2000)

    let txinfo = await addressReceivedMoneyInThisTx(fundingAddress)

    let txid = txinfo[0]
    let vout = txinfo[1]
    let amt = txinfo[2]

    params.log(`Funding transaction ${txid} confirmed, waiting for inscription to be confirmed...`)

    let outputs = []

        outputs.push(
            {
                value: padding + inscription.fee,
                scriptPubKey: [ 'OP_1', inscription.tapkey ]
            }
        )

    if(!isNaN(tip) && tip >= 500) {
        outputs.push(
            {
                value: tip,
                scriptPubKey: [ 'OP_1', Address.p2tr.decode(params.tippingAddress).hex ]
            }
        )
    }

    const init_redeemtx = Tx.create({
        vin: [{
            txid: txid,
            vout: vout,
            prevout: {
                value: amt,
                scriptPubKey: [ 'OP_1', init_tapkey ]
            },
        }],
        vout : outputs
    })

    const init_sig = await Signer.taproot.sign(seckey.raw, init_redeemtx, 0, {extension: init_leaf})
    init_redeemtx.vin[0].witness = [ init_sig.hex, init_script, init_cblock ]

    let rawtx = Tx.encode(init_redeemtx).hex
    await pushBTCpmt(rawtx)

    inscribe(params.log, seckey, address, inscription)
}
