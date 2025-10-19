import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './wallet.css';
import '@aptos-labs/wallet-adapter-ant-design/dist/index.css';


import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.TESTNET,
      }}
      onError={(error) => {
        console.log("Wallet error", error);
      }}
    >
      <App />
    </AptosWalletAdapterProvider>
  </React.StrictMode>,
)