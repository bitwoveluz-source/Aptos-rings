import { ChakraProvider } from '@chakra-ui/react';
import classyTheme from './classyTheme';
import './smoke.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import GalleryPage from './pages/GalleryPage';

function App() {
  return (
    <ChakraProvider theme={classyTheme}>
      <div className="smoke-bg">
        <div className="smoke">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <Router>
          <Routes>
            <Route path="/" element={<UserPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/GalleryPage" element={<GalleryPage />} />
          </Routes>
        </Router>
      </div>
    </ChakraProvider>
  );
}

export default App;