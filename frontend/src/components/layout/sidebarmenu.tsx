import React from 'react';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import GroupsIcon from '@mui/icons-material/Groups';
import MapIcon from '@mui/icons-material/Map';
import LanIcon from '@mui/icons-material/Lan';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';

const menuItems = [
  { text: 'Grupos', icon: <GroupsIcon /> },
  { text: 'Mapas', icon: <MapIcon /> },
  { text: 'Topologia', icon: <LanIcon /> },
  { text: "POP's", icon: <SettingsEthernetIcon /> },
];

export default function SidebarMenu() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 80,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: 80, boxSizing: 'border-box', bgcolor: '#18191c', color: '#fff' },
      }}
    >
      <List>
        {menuItems.map((item, idx) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
              <ListItemIcon sx={{ color: idx === 0 ? '#ff4b5c' : '#fff', minWidth: 0 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 12, textAlign: 'center' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
    </Drawer>
  );
}

