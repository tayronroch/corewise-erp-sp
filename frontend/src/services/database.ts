import type { MapConfiguration, MapItem, MapConnection } from '../types/mapTypes';

export interface DatabaseSchema {
  maps: MapConfiguration[];
  items: MapItem[];
  connections: MapConnection[];
  metadata: {
    version: string;
    lastUpdated: string;
    totalMaps: number;
  };
}

class LocalDatabase {
  private dbKey = 'corewise-local-database';
  private version = '1.0.0';

  private getDatabase(): DatabaseSchema {
    try {
      const data = localStorage.getItem(this.dbKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar banco de dados:', error);
    }

    // Retorna banco vazio se não existir
    return this.createEmptyDatabase();
  }

  private createEmptyDatabase(): DatabaseSchema {
    return {
      maps: [],
      items: [],
      connections: [],
      metadata: {
        version: this.version,
        lastUpdated: new Date().toISOString(),
        totalMaps: 0,
      },
    };
  }

  private saveDatabase(db: DatabaseSchema): boolean {
    try {
      db.metadata.lastUpdated = new Date().toISOString();
      db.metadata.totalMaps = db.maps.length;
      localStorage.setItem(this.dbKey, JSON.stringify(db, null, 2));
      return true;
    } catch (error) {
      console.error('Erro ao salvar banco de dados:', error);
      return false;
    }
  }

  // MAPS
  getAllMaps(): MapConfiguration[] {
    const db = this.getDatabase();
    return db.maps.map(map => ({
      ...map,
      createdAt: new Date(map.createdAt),
      updatedAt: new Date(map.updatedAt),
    }));
  }

  getMapById(id: string): MapConfiguration | null {
    const db = this.getDatabase();
    const map = db.maps.find(m => m.id === id);
    if (map) {
      return {
        ...map,
        createdAt: new Date(map.createdAt),
        updatedAt: new Date(map.updatedAt),
      };
    }
    return null;
  }

  saveMap(map: MapConfiguration): boolean {
    const db = this.getDatabase();
    const existingIndex = db.maps.findIndex(m => m.id === map.id);
    
    const mapToSave = {
      ...map,
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      db.maps[existingIndex] = mapToSave;
    } else {
      db.maps.push(mapToSave);
    }

    return this.saveDatabase(db);
  }

  deleteMap(id: string): boolean {
    const db = this.getDatabase();
    db.maps = db.maps.filter(m => m.id !== id);
    // Também remover itens e conexões do mapa
    db.items = db.items.filter(item => !item.id.includes(id));
    db.connections = db.connections.filter(conn => !conn.id.includes(id));
    return this.saveDatabase(db);
  }

  // ITEMS
  getItemsByMapId(mapId: string): MapItem[] {
    const map = this.getMapById(mapId);
    return map ? map.items.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })) : [];
  }

  saveItem(mapId: string, item: MapItem): boolean {
    const db = this.getDatabase();
    const mapIndex = db.maps.findIndex(m => m.id === mapId);
    
    if (mapIndex === -1) return false;

    const itemToSave = {
      ...item,
      updatedAt: new Date(),
    };

    const existingItemIndex = db.maps[mapIndex].items.findIndex(i => i.id === item.id);
    
    if (existingItemIndex >= 0) {
      db.maps[mapIndex].items[existingItemIndex] = itemToSave;
    } else {
      db.maps[mapIndex].items.push(itemToSave);
    }

    db.maps[mapIndex].updatedAt = new Date();
    return this.saveDatabase(db);
  }

  deleteItem(mapId: string, itemId: string): boolean {
    const db = this.getDatabase();
    const mapIndex = db.maps.findIndex(m => m.id === mapId);
    
    if (mapIndex === -1) return false;

    db.maps[mapIndex].items = db.maps[mapIndex].items.filter(i => i.id !== itemId);
    // Também remover conexões que usam este item
    db.maps[mapIndex].connections = db.maps[mapIndex].connections.filter(
      c => c.sourceId !== itemId && c.targetId !== itemId
    );
    
    db.maps[mapIndex].updatedAt = new Date();
    return this.saveDatabase(db);
  }

  // CONNECTIONS
  getConnectionsByMapId(mapId: string): MapConnection[] {
    const map = this.getMapById(mapId);
    return map ? map.connections.map(conn => ({
      ...conn,
      createdAt: new Date(conn.createdAt),
      updatedAt: new Date(conn.updatedAt),
    })) : [];
  }

  saveConnection(mapId: string, connection: MapConnection): boolean {
    const db = this.getDatabase();
    const mapIndex = db.maps.findIndex(m => m.id === mapId);
    
    if (mapIndex === -1) return false;

    const connectionToSave = {
      ...connection,
      updatedAt: new Date(),
    };

    const existingConnectionIndex = db.maps[mapIndex].connections.findIndex(c => c.id === connection.id);
    
    if (existingConnectionIndex >= 0) {
      db.maps[mapIndex].connections[existingConnectionIndex] = connectionToSave;
    } else {
      db.maps[mapIndex].connections.push(connectionToSave);
    }

    db.maps[mapIndex].updatedAt = new Date();
    return this.saveDatabase(db);
  }

  deleteConnection(mapId: string, connectionId: string): boolean {
    const db = this.getDatabase();
    const mapIndex = db.maps.findIndex(m => m.id === mapId);
    
    if (mapIndex === -1) return false;

    db.maps[mapIndex].connections = db.maps[mapIndex].connections.filter(c => c.id !== connectionId);
    db.maps[mapIndex].updatedAt = new Date();
    return this.saveDatabase(db);
  }

  // BACKUP & RESTORE
  exportDatabase(): string {
    const db = this.getDatabase();
    return JSON.stringify(db, null, 2);
  }

  importDatabase(jsonData: string): boolean {
    try {
      const importedDb = JSON.parse(jsonData) as DatabaseSchema;
      
      // Validar estrutura básica
      if (!importedDb.maps || !importedDb.items || !importedDb.connections || !importedDb.metadata) {
        throw new Error('Estrutura de banco inválida');
      }

      return this.saveDatabase(importedDb);
    } catch (error) {
      console.error('Erro ao importar banco de dados:', error);
      return false;
    }
  }

  clearDatabase(): boolean {
    const emptyDb = this.createEmptyDatabase();
    return this.saveDatabase(emptyDb);
  }

  getStatistics() {
    const db = this.getDatabase();
    return {
      totalMaps: db.maps.length,
      totalItems: db.maps.reduce((sum, map) => sum + map.items.length, 0),
      totalConnections: db.maps.reduce((sum, map) => sum + map.connections.length, 0),
      lastUpdated: db.metadata.lastUpdated,
      version: db.metadata.version,
      databaseSize: new Blob([JSON.stringify(db)]).size,
    };
  }
}

export const localDatabase = new LocalDatabase(); 