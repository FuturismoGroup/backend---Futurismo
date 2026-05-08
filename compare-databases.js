const { Client } = require('pg');

// Configuración de conexiones
const LOCAL_DB = {
  connectionString: 'postgresql://postgres:sql@127.0.0.1:5432/futurismo_db',
  ssl: false,
};

const RAILWAY_DB = {
  connectionString: 'postgresql://postgres:xHTUqbWwgRVtwPiExOPXGUBtVFUeadwc@nozomi.proxy.rlwy.net:55727/railway',
  ssl: { rejectUnauthorized: false },
};

// Queries para extraer metadata
const QUERIES = {
  tables: `
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `,
  columns: `
    SELECT
      table_name,
      column_name,
      ordinal_position,
      column_default,
      is_nullable,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `,
  constraints: `
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `,
  indexes: `
    SELECT
      tablename AS table_name,
      indexname AS index_name,
      indexdef AS index_definition
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `,
  triggers: `
    SELECT
      event_object_table AS table_name,
      trigger_name,
      event_manipulation,
      action_timing,
      action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `,
  functions: `
    SELECT
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS arguments,
      pg_get_function_result(p.oid) AS return_type,
      p.prosrc AS source_code,
      CASE p.prokind
        WHEN 'f' THEN 'function'
        WHEN 'p' THEN 'procedure'
        WHEN 'a' THEN 'aggregate'
        WHEN 'w' THEN 'window'
      END AS kind,
      l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `,
  views: `
    SELECT
      table_name AS view_name,
      view_definition
    FROM information_schema.views
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `,
  sequences: `
    SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name;
  `,
  enums: `
    SELECT
      t.typname AS enum_name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
  `,
  extensions: `
    SELECT extname, extversion
    FROM pg_extension
    ORDER BY extname;
  `,
  rowCounts: `
    SELECT
      schemaname,
      relname AS table_name,
      n_live_tup AS estimated_row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname;
  `,
  dbSettings: `
    SELECT name, setting
    FROM pg_settings
    WHERE name IN ('timezone', 'server_version', 'max_connections', 'shared_buffers', 'work_mem')
    ORDER BY name;
  `,
};

async function fetchAll(client, label) {
  const results = {};
  for (const [key, query] of Object.entries(QUERIES)) {
    try {
      const res = await client.query(query);
      results[key] = res.rows;
    } catch (err) {
      console.error(`  [${label}] Error en query "${key}": ${err.message}`);
      results[key] = [];
    }
  }
  return results;
}

// ─── Comparadores ────────────────────────────────────────────

function compareTables(local, railway) {
  const diffs = [];
  const localNames = new Set(local.map(t => t.table_name));
  const railwayNames = new Set(railway.map(t => t.table_name));

  for (const name of localNames) {
    if (!railwayNames.has(name)) {
      diffs.push(`  + SOLO en LOCAL: ${name}`);
    }
  }
  for (const name of railwayNames) {
    if (!localNames.has(name)) {
      diffs.push(`  - SOLO en RAILWAY: ${name}`);
    }
  }
  return diffs;
}

function compareColumns(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) {
      const key = `${r.table_name}.${r.column_name}`;
      m[key] = r;
    }
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];

    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key} (${l.udt_name}, nullable=${l.is_nullable})`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key} (${r.udt_name}, nullable=${r.is_nullable})`);
    } else {
      // Ambos existen, comparar atributos
      const changes = [];
      if (l.udt_name !== r.udt_name) changes.push(`tipo: LOCAL=${l.udt_name} vs RAILWAY=${r.udt_name}`);
      if (l.is_nullable !== r.is_nullable) changes.push(`nullable: LOCAL=${l.is_nullable} vs RAILWAY=${r.is_nullable}`);
      if (normalizeDefault(l.column_default) !== normalizeDefault(r.column_default)) {
        changes.push(`default: LOCAL=${l.column_default || 'NULL'} vs RAILWAY=${r.column_default || 'NULL'}`);
      }
      if (l.character_maximum_length !== r.character_maximum_length) {
        changes.push(`max_length: LOCAL=${l.character_maximum_length} vs RAILWAY=${r.character_maximum_length}`);
      }
      if (changes.length > 0) {
        diffs.push(`  ~ DIFERENCIA en ${key}: ${changes.join('; ')}`);
      }
    }
  }
  return diffs;
}

function normalizeDefault(val) {
  if (!val) return '';
  // Normalizar UUIDs y secuencias
  return val.replace(/::[\w\s\[\]]+/g, '').trim();
}

function compareConstraints(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) {
      const key = `${r.table_name}.${r.constraint_name}`;
      if (!m[key]) m[key] = { ...r, columns: [] };
      m[key].columns.push(r.column_name);
    }
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key} (${l.constraint_type})`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key} (${r.constraint_type})`);
    } else {
      if (l.constraint_type !== r.constraint_type) {
        diffs.push(`  ~ ${key}: tipo LOCAL=${l.constraint_type} vs RAILWAY=${r.constraint_type}`);
      }
      const lCols = l.columns.sort().join(',');
      const rCols = r.columns.sort().join(',');
      if (lCols !== rCols) {
        diffs.push(`  ~ ${key}: columnas LOCAL=[${lCols}] vs RAILWAY=[${rCols}]`);
      }
    }
  }
  return diffs;
}

function compareIndexes(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.index_name] = r;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key} ON ${l.table_name}`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key} ON ${r.table_name}`);
    } else {
      // Normalizar definición (quitar nombre de esquema diferente)
      const lDef = l.index_definition.replace(/public\./g, '');
      const rDef = r.index_definition.replace(/public\./g, '');
      if (lDef !== rDef) {
        diffs.push(`  ~ DIFERENCIA en ${key}:`);
        diffs.push(`    LOCAL:   ${l.index_definition}`);
        diffs.push(`    RAILWAY: ${r.index_definition}`);
      }
    }
  }
  return diffs;
}

function compareTriggers(local, railway) {
  const diffs = [];
  const toKey = (r) => `${r.table_name}.${r.trigger_name}.${r.event_manipulation}`;
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[toKey(r)] = r;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key}`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key}`);
    } else {
      if (l.action_statement !== r.action_statement) {
        diffs.push(`  ~ DIFERENCIA en ${key}: action_statement difiere`);
      }
    }
  }
  return diffs;
}

function compareFunctions(local, railway) {
  const diffs = [];
  const toKey = (r) => `${r.function_name}(${r.arguments})`;
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[toKey(r)] = r;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key} -> ${l.return_type} [${l.language}]`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key} -> ${r.return_type} [${r.language}]`);
    } else {
      const changes = [];
      if (l.return_type !== r.return_type) changes.push(`return: ${l.return_type} vs ${r.return_type}`);
      if (l.source_code?.trim() !== r.source_code?.trim()) changes.push('código fuente difiere');
      if (l.language !== r.language) changes.push(`lenguaje: ${l.language} vs ${r.language}`);
      if (changes.length) {
        diffs.push(`  ~ DIFERENCIA en ${key}: ${changes.join('; ')}`);
      }
    }
  }
  return diffs;
}

function compareViews(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.view_name] = r;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key}`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key}`);
    } else {
      const lDef = l.view_definition?.trim();
      const rDef = r.view_definition?.trim();
      if (lDef !== rDef) {
        diffs.push(`  ~ DIFERENCIA en ${key}: definición difiere`);
        diffs.push(`    LOCAL:   ${lDef?.substring(0, 120)}...`);
        diffs.push(`    RAILWAY: ${rDef?.substring(0, 120)}...`);
      }
    }
  }
  return diffs;
}

function compareSequences(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.sequence_name] = r;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key}`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key}`);
    }
  }
  return diffs;
}

function compareEnums(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.enum_name] = r.enum_values;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key} = [${l.join(', ')}]`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key} = [${r.join(', ')}]`);
    } else {
      const lVals = l.join(',');
      const rVals = r.join(',');
      if (lVals !== rVals) {
        diffs.push(`  ~ DIFERENCIA en ${key}:`);
        diffs.push(`    LOCAL:   [${l.join(', ')}]`);
        diffs.push(`    RAILWAY: [${r.join(', ')}]`);
      }
    }
  }
  return diffs;
}

function compareExtensions(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.extname] = r.extversion;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key];
    const r = railwayMap[key];
    if (l && !r) {
      diffs.push(`  + SOLO en LOCAL: ${key} v${l}`);
    } else if (!l && r) {
      diffs.push(`  - SOLO en RAILWAY: ${key} v${r}`);
    } else if (l !== r) {
      diffs.push(`  ~ ${key}: LOCAL=v${l} vs RAILWAY=v${r}`);
    }
  }
  return diffs;
}

function compareRowCounts(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.table_name] = Number(r.estimated_row_count);
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allTables = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  const rows = [];
  for (const t of [...allTables].sort()) {
    const l = localMap[t] ?? '-';
    const r = railwayMap[t] ?? '-';
    if (l !== r) {
      rows.push(`  ${t.padEnd(40)} LOCAL=${String(l).padStart(6)}  RAILWAY=${String(r).padStart(6)}`);
    }
  }
  return rows;
}

function compareSettings(local, railway) {
  const diffs = [];
  const toMap = (rows) => {
    const m = {};
    for (const r of rows) m[r.name] = r.setting;
    return m;
  };

  const localMap = toMap(local);
  const railwayMap = toMap(railway);
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(railwayMap)]);

  for (const key of [...allKeys].sort()) {
    const l = localMap[key] || '(no existe)';
    const r = railwayMap[key] || '(no existe)';
    diffs.push(`  ${key.padEnd(25)} LOCAL=${l.padEnd(20)} RAILWAY=${r}`);
  }
  return diffs;
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(80));
  console.log('  COMPARACIÓN DE BASES DE DATOS: LOCAL vs RAILWAY');
  console.log('  Fecha: ' + new Date().toISOString());
  console.log('='.repeat(80));

  const localClient = new Client(LOCAL_DB);
  const railwayClient = new Client(RAILWAY_DB);

  try {
    console.log('\nConectando a LOCAL...');
    await localClient.connect();
    console.log('Conectando a RAILWAY...');
    await railwayClient.connect();

    console.log('Extrayendo metadata de ambas bases de datos...\n');

    const [localData, railwayData] = await Promise.all([
      fetchAll(localClient, 'LOCAL'),
      fetchAll(railwayClient, 'RAILWAY'),
    ]);

    const sections = [
      { title: '1. CONFIGURACIÓN DEL SERVIDOR', fn: () => compareSettings(localData.dbSettings, railwayData.dbSettings) },
      { title: '2. EXTENSIONES', fn: () => compareExtensions(localData.extensions, railwayData.extensions) },
      { title: '3. ENUMS (tipos personalizados)', fn: () => compareEnums(localData.enums, railwayData.enums) },
      { title: '4. TABLAS', fn: () => compareTables(localData.tables, railwayData.tables) },
      { title: '5. COLUMNAS', fn: () => compareColumns(localData.columns, railwayData.columns) },
      { title: '6. CONSTRAINTS (PK, FK, UNIQUE, CHECK)', fn: () => compareConstraints(localData.constraints, railwayData.constraints) },
      { title: '7. ÍNDICES', fn: () => compareIndexes(localData.indexes, railwayData.indexes) },
      { title: '8. TRIGGERS', fn: () => compareTriggers(localData.triggers, railwayData.triggers) },
      { title: '9. FUNCIONES Y PROCEDIMIENTOS', fn: () => compareFunctions(localData.functions, railwayData.functions) },
      { title: '10. VISTAS', fn: () => compareViews(localData.views, railwayData.views) },
      { title: '11. SECUENCIAS', fn: () => compareSequences(localData.sequences, railwayData.sequences) },
      { title: '12. CONTEO DE FILAS (estimado)', fn: () => compareRowCounts(localData.rowCounts, railwayData.rowCounts) },
    ];

    let totalDiffs = 0;

    for (const section of sections) {
      console.log('\n' + '─'.repeat(80));
      console.log(`  ${section.title}`);
      console.log('─'.repeat(80));

      const diffs = section.fn();
      if (diffs.length === 0) {
        console.log('  ✓ Sin diferencias');
      } else {
        totalDiffs += diffs.length;
        for (const d of diffs) console.log(d);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`  RESUMEN: ${totalDiffs} diferencia(s) encontrada(s)`);
    console.log('  Leyenda:');
    console.log('    + SOLO en LOCAL    = existe en local pero NO en Railway');
    console.log('    - SOLO en RAILWAY  = existe en Railway pero NO en local');
    console.log('    ~ DIFERENCIA       = existe en ambas pero con valores distintos');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('Error fatal:', err.message);
  } finally {
    await localClient.end().catch(() => {});
    await railwayClient.end().catch(() => {});
  }
}

main();
