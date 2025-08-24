import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircle from '@mui/icons-material/AccountCircle';
import GridViewIcon from '@mui/icons-material/GridView';
import MenuIcon from '@mui/icons-material/Menu';

export default function Header() {
  return (
    <AppBar 
      position="static" 
      color="default" 
      sx={{
        background: '#18191c !important',
        color: '#fff !important',
        boxShadow: 'none !important',
      }}
    >
      <Toolbar>
        <IconButton edge="start" color="inherit" aria-label="menu" style={{ marginRight: 8 }}>
          <MenuIcon />
        </IconButton>
        <Typography 
          variant="h5" 
          sx={{
            fontWeight: '700 !important',
            color: '#ff4b5c !important',
            marginRight: '8px !important',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{
            fontWeight: 900,
            color: '#fff',
            marginRight: '4px',
          }}>●</span> 
          CoreWise<span style={{ color: '#ff4b5c' }}>Maps</span>
        </Typography>
        <div style={{ flexGrow: 1 }} />
        <IconButton color="inherit">
          <SettingsIcon />
        </IconButton>
        <IconButton color="inherit">
          <GridViewIcon />
        </IconButton>
        <IconButton color="inherit">
          <NotificationsIcon />
        </IconButton>
        <IconButton color="inherit">
          <AccountCircle />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}

