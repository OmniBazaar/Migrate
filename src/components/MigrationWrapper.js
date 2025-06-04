import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import MigrationForm from './MigrationForm';

// Create a theme that can be customized by the parent application
const defaultTheme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const MigrationWrapper = ({ 
  theme = defaultTheme,
  onSuccess,
  onError,
  className,
  style
}) => {
  return (
    <ThemeProvider theme={theme}>
      <div className={className} style={style}>
        <MigrationForm 
          onSuccess={onSuccess}
          onError={onError}
        />
      </div>
    </ThemeProvider>
  );
};

export default MigrationWrapper; 