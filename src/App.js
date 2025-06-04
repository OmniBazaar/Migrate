import React from 'react';
import { createTheme } from '@mui/material';
import MigrationWrapper from './components/MigrationWrapper';

// Example of customizing the theme to match your application
const customTheme = createTheme({
  palette: {
    primary: {
      main: '#2196f3', // Custom primary color
    },
    secondary: {
      main: '#f50057', // Custom secondary color
    },
  },
});

function App() {
  const handleMigrationSuccess = (data) => {
    console.log('Migration successful:', data);
    // Handle successful migration
    // e.g., redirect to dashboard, show success message, etc.
  };

  const handleMigrationError = (error) => {
    console.error('Migration failed:', error);
    // Handle migration error
    // e.g., show error message, retry logic, etc.
  };

  return (
    <div className="App">
      <MigrationWrapper
        theme={customTheme}
        onSuccess={handleMigrationSuccess}
        onError={handleMigrationError}
        className="migration-container"
        style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}
      />
    </div>
  );
}

export default App; 