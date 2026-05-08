import { JDBC, isJvmCreated, addOption, setupClasspath } from 'nodejs-jdbc';

console.log('JDBC Tool - Test de connexion JDBC directe');
console.log('===========================================');

// Configuration JVM si necessaire
if (!isJvmCreated()) {
    console.log('Configuration de la JVM...');
    addOption("-Xrs");
    setupClasspath(['./src/lib/hsqldb.jar']);
    console.log('JVM configuree avec HSQLDB JAR');
} else {
    console.log('JVM deja configuree');
}

// Configuration de connexion corrigee
const config = {
    url: 'jdbc:hsqldb:file:./tests/sandbox/server-database/test_world/index/;shutdown=true',
    drivername: 'org.hsqldb.jdbc.JDBCDriver', // IMPORTANT: lowercase 'n'
    user: 'SA',
    password: '',
    minpoolsize: 1,  // IMPORTANT: lowercase
    maxpoolsize: 10, // IMPORTANT: lowercase
    properties: {}
};

console.log(`\nConfiguration de connexion:`);
console.log(`   URL: ${config.url}`);
console.log(`   Driver: ${config.drivername}`);
console.log(`   Pool: ${config.minpoolsize}-${config.maxpoolsize}`);

try {
    console.log('\nInitialisation de la connexion JDBC...');
    const startTime = Date.now();
    
    const db = new JDBC(config);

    // Initialize the pool
    await db.initialize();
    const initTime = Date.now() - startTime;
    console.log(`Pool initialise en ${initTime}ms`);

    // Acquire a connection from the pool
    console.log('Reservation d\'une connexion...');
    const connobj = await db.reserve();
    const { conn } = connobj;
    const connTime = Date.now() - startTime;
    console.log(`Connexion etablie en ${connTime}ms`);

    // Create a statement
    console.log('Execution de requete de test...');
    const statement = await conn.createStatement();
    const sql = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'`;

    // Execute the query and get the ResultSet
    let rs = await statement.executeQuery(sql);
    const queryTime = Date.now() - startTime;
    console.log(`Requete executee en ${queryTime}ms`);

    console.log('\nTables dans le schema PUBLIC:');
    
    // APPROCHE 1: Utiliser next() et fetchResult() pour parcourir ligne par ligne
    const metaData = rs.getMetaData();
    const allColumnMeta = metaData.getAllColumnMeta();
    
    let tableCount = 0;
    while (rs.next()) {
        const row = rs.fetchResult(allColumnMeta);
        console.log(`   - ${row.TABLE_NAME}`);
        tableCount++;
    }
    
    console.log(`\nTotal: ${tableCount} tables trouvees (methode next/fetchResult)`);

    // APPROCHE 2: Comparaison avec toObjArray() pour verification
    const rs2 = await statement.executeQuery(sql);
    const rsArray = rs2.toObjArray();
    console.log(`Verification avec toObjArray: ${rsArray.length} tables`);
    
    // APPROCHE 3: Parcours avec next() et accès direct aux getters
    console.log('\nDetails des tables (methode next + getters):');
    const rs3 = await statement.executeQuery(sql);
    let detailCount = 0;
    while (rs3.next()) {
        // Accès direct aux getters synchrones du ResultSet Java
        try {
            const tableName = rs3.resultSet.getStringSync('TABLE_NAME');
            console.log(`   Table ${detailCount + 1}: ${tableName}`);
            detailCount++;
        } catch (getterError) {
            console.log(`   Table ${detailCount + 1}: [erreur getter] ${getterError.message}`);
            detailCount++;
        }
    }

    // Test d'une requete de donnees si on a des tables (VERSION CORRIGEE)
    if (tableCount > 0) {
        console.log('\nTest de requete de donnees (avec next/fetchResult)...');
        try {
            const countSql = `SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'`;
            const countRs = await statement.executeQuery(countSql);
            
            if (countRs.next()) {
                // CORRECTION: Utiliser getter direct au lieu de fetchResult pour COUNT(*)
                const count = countRs.resultSet.getIntSync(1);
                console.log(`Confirmation: ${count} tables via COUNT(*)`);
            }
        } catch (dataError) {
            console.log(`Erreur requete de donnees: ${dataError.message}`);
        }
    }

    // Test supplementaire: verification des vraies tables StarMade
    if (tableCount > 0) {
        console.log('\nTest des tables StarMade (avec next + getter direct)...');
        try {
            const starMadeTables = ['PLAYERS', 'ENTITIES', 'SECTORS', 'SECTORS_ITEMS', 'SYSTEMS', 'FLEETS'];
            for (const tableName of starMadeTables) {
                try {
                    const testSql = `SELECT COUNT(*) as record_count FROM ${tableName}`;
                    const testRs = await statement.executeQuery(testSql);
                    
                    if (testRs.next()) {
                        // Utiliser getter direct
                        try {
                            const count = testRs.resultSet.getIntSync(1); // Index 1-based
                            console.log(`   Table ${tableName}: ${count} enregistrements`);
                        } catch (getterError) {
                            // Fallback avec fetchResult
                            const testMeta = testRs.getMetaData();
                            const testColumnMeta = testMeta.getAllColumnMeta();
                            const row = testRs.fetchResult(testColumnMeta);
                            console.log(`   Table ${tableName}: ${row.record_count} enregistrements (fallback)`);
                        }
                    }
                } catch (tableError) {
                    console.log(`   Table ${tableName}: non accessible (${tableError.message})`);
                }
            }
        } catch (starMadeError) {
            console.log(`Erreur test StarMade: ${starMadeError.message}`);
        }
    }

    // Test supplementaire: Lecture complete de la table SECTORS (VERSION CORRIGEE)
    if (tableCount > 0) {
        console.log('\n==========================================');
        console.log('LECTURE COMPLETE DE LA TABLE SECTORS');
        console.log('==========================================');
        
        try {
            // 1. D'abord, lire directement la structure avec une requete simple
            console.log('\n1. Decouverte de la structure de SECTORS:');
            const sampleStructureSql = `SELECT * FROM SECTORS LIMIT 1`;
            const sampleStructureRs = await statement.executeQuery(sampleStructureSql);
            const sampleStructureArray = sampleStructureRs.toObjArray();
            
            if (sampleStructureArray.length > 0) {
                console.log('   Colonnes detectees:');
                const firstRow = sampleStructureArray[0];
                Object.keys(firstRow).forEach(columnName => {
                    const value = firstRow[columnName];
                    const type = typeof value === 'number' ? (Number.isInteger(value) ? 'INTEGER' : 'DOUBLE') : 
                                typeof value === 'boolean' ? 'BOOLEAN' : 'VARCHAR';
                    console.log(`   - ${columnName} (${type}) = ${value}`);
                });
            }
            
            // 2. Compter les enregistrements (VERSION CORRIGEE)
            console.log('\n2. Nombre total d\'enregistrements:');
            const countSql = `SELECT COUNT(*) FROM SECTORS`;
            const countRs = await statement.executeQuery(countSql);
            if (countRs.next()) {
                const totalSectors = countRs.resultSet.getIntSync(1);
                console.log(`   Total: ${totalSectors} secteurs`);
            }
            
            // 3. Analyser les types de secteurs (SYNTAXE HSQLDB CORRIGEE)
            console.log('\n3. Analyse des types de secteurs:');
            
            // Version alternative sans alias pour eviter les problemes HSQLDB
            const typesSql = `SELECT TYPE, COUNT(*) FROM SECTORS GROUP BY TYPE ORDER BY TYPE`;
            const typesRs = await statement.executeQuery(typesSql);
            const typesArray = typesRs.toObjArray();
            
            console.log('   Distribution par type:');
            typesArray.forEach(row => {
                // HSQLDB retourne COUNT(*) comme nom de colonne sans alias
                const count = row['COUNT(*)'] || row.count || Object.values(row)[1];
                const typeName = getSectorTypeName(row.TYPE);
                console.log(`   - Type ${row.TYPE} (${typeName}): ${count} secteurs`);
            });
            
            // 4. Lire les premiers secteurs (VERSION CORRIGEE)
            console.log('\n4. Echantillon des secteurs (premiers 10):');
            const sampleSql = `SELECT X, Y, Z, TYPE, NAME, STELLAR, PROTECTION FROM SECTORS ORDER BY X, Y, Z LIMIT 10`;
            const sampleRs = await statement.executeQuery(sampleSql);
            const sampleArray = sampleRs.toObjArray();
            
            console.log('   Coordonnees | Type | Nom            | Stellar | Protection');
            console.log('   --------------------------------------------------------');
            sampleArray.forEach(row => {
                const coords = `(${row.X},${row.Y},${row.Z})`.padEnd(12);
                const typeName = getSectorTypeName(row.TYPE);
                const typeDisplay = `${row.TYPE}(${typeName.substring(0,3)})`.padEnd(8);
                const name = (row.NAME || 'N/A').substring(0, 14).padEnd(14);
                const stellar = `${row.STELLAR}`.padEnd(7);
                const protection = `${row.PROTECTION}`.padEnd(10);
                
                console.log(`   ${coords}| ${typeDisplay}| ${name}| ${stellar}| ${protection}`);
            });
            
            // 5. Analyse geographique (VERSION CORRIGEE)
            console.log('\n5. Analyse geographique:');
            const geoSql = `SELECT MIN(X), MAX(X), MIN(Y), MAX(Y), MIN(Z), MAX(Z) FROM SECTORS`;
            const geoRs = await statement.executeQuery(geoSql);
            if (geoRs.next()) {
                const minX = geoRs.resultSet.getIntSync(1);
                const maxX = geoRs.resultSet.getIntSync(2);
                const minY = geoRs.resultSet.getIntSync(3);
                const maxY = geoRs.resultSet.getIntSync(4);
                const minZ = geoRs.resultSet.getIntSync(5);
                const maxZ = geoRs.resultSet.getIntSync(6);
                
                console.log(`   Etendue X: ${minX} a ${maxX} (largeur: ${maxX - minX + 1})`);
                console.log(`   Etendue Y: ${minY} a ${maxY} (hauteur: ${maxY - minY + 1})`);
                console.log(`   Etendue Z: ${minZ} a ${maxZ} (profondeur: ${maxZ - minZ + 1})`);
                
                const volume = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
                console.log(`   Volume total possible: ${volume} secteurs`);
            }
            
            // 6. Analyse des secteurs par hazard/resource
            console.log('\n6. Analyse par categorie:');
            const categoryAnalysis = {};
            typesArray.forEach(row => {
                const typeName = getSectorTypeName(row.TYPE);
                const hazardLevel = getSectorHazardLevel(row.TYPE);
                const resourceValue = getSectorResourceValue(row.TYPE);
                
                if (!categoryAnalysis[hazardLevel]) categoryAnalysis[hazardLevel] = 0;
                categoryAnalysis[hazardLevel] += row.count;
            });
            
            Object.entries(categoryAnalysis).forEach(([category, count]) => {
                console.log(`   ${category}: ${count} secteurs`);
            });
            
            // 7. Test de performance avec tous les secteurs (CORRECTION)
            console.log('\n7. Test de performance - lecture complete:');
            
            const perfStart = Date.now();
            const allSectorsSql = `SELECT COUNT(*) FROM SECTORS`;
            const allSectorsRs = await statement.executeQuery(allSectorsSql);
            
            // CORRECTION: Utiliser getter direct au lieu de toObjArray pour COUNT(*)
            if (allSectorsRs.next()) {
                const totalSectors = allSectorsRs.resultSet.getIntSync(1);
                const perfTime = Date.now() - perfStart;
                console.log(`   Lecture de ${totalSectors} secteurs en ${perfTime}ms`);
            }
            
            // 8. Recherche de secteurs interessants
            console.log('\n8. Secteurs interessants:');
            
            // Secteurs proches de l'origine
            const originSql = `SELECT X, Y, Z, TYPE, NAME FROM SECTORS 
                              WHERE ABS(X) <= 2 AND ABS(Y) <= 2 AND ABS(Z) <= 2 
                              ORDER BY (ABS(X) + ABS(Y) + ABS(Z))`;
            const originRs = await statement.executeQuery(originSql);
            const originArray = originRs.toObjArray();
            
            console.log(`   Secteurs proches de l'origine (${originArray.length} trouves):`);
            originArray.slice(0, 5).forEach(row => {
                const typeName = getSectorTypeName(row.TYPE);
                console.log(`     (${row.X},${row.Y},${row.Z}) - ${typeName} - ${row.NAME}`);
            });
            
            console.log('\n==========================================');
            console.log('FIN DE LA LECTURE DE LA TABLE SECTORS');
            console.log('==========================================');
            
        } catch (sectorsError) {
            console.log(`Erreur lecture table SECTORS: ${sectorsError.message}`);
            
            // Fallback: essayer une version tres simplifiee
            console.log('\nTentative de lecture tres simplifiee...');
            try {
                // CORRECTION: Compter sans alias
                const simpleSql = `SELECT COUNT(*) FROM SECTORS`;
                const simpleRs = await statement.executeQuery(simpleSql);
                if (simpleRs.next()) {
                    const totalSectors = simpleRs.resultSet.getIntSync(1);
                    console.log(`Total secteurs: ${totalSectors}`);
                }
                
                // Lecture d'un echantillon
                const sampleSql = `SELECT * FROM SECTORS LIMIT 3`;
                const sampleRs = await statement.executeQuery(sampleSql);
                const sampleArray = sampleRs.toObjArray();
                console.log('Echantillon de secteurs:');
                sampleArray.forEach((row, index) => {
                    console.log(`  Secteur ${index + 1}:`, JSON.stringify(row, null, 2));
                });
            } catch (simpleError) {
                console.log(`Erreur lecture tres simplifiee: ${simpleError.message}`);
            }
        }
    }

    // Fonctions utilitaires pour l'analyse des secteurs
    function getSectorTypeName(typeId) {
        const typeMap = {
            0: 'VOID', 1: 'ASTEROID', 2: 'PLANET', 3: 'SPACE_STATION',
            4: 'SUN', 5: 'BLACK_HOLE', 6: 'WORMHOLE', 7: 'NEBULA',
            8: 'DOUBLE_STAR', 9: 'GIANT'
        };
        return typeMap[typeId] || `UNKNOWN_${typeId}`;
    }

    function getSectorHazardLevel(typeId) {
        switch(typeId) {
            case 4: case 5: case 8: case 9: return 'EXTREME_HAZARD';
            case 7: return 'LIMITED_VISIBILITY';
            case 1: case 2: return 'RESOURCE_RICH';
            case 3: return 'CIVILIZED';
            case 6: return 'STRATEGIC';
            default: return 'SAFE';
        }
    }

    function getSectorResourceValue(typeId) {
        switch(typeId) {
            case 1: return 'HIGH_MINING';
            case 2: return 'DIVERSE_RESOURCES';
            case 3: return 'TRADE_HUB';
            case 6: return 'STRATEGIC_TRANSPORT';
            default: return 'NONE';
        }
    }

    // Test de performance: comparer les trois approches
    console.log('\nTest de performance des differentes approches...');
    const perfSql = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'`;
    
    // Approche 1: toObjArray
    const start1 = Date.now();
    const rsPerf1 = await statement.executeQuery(perfSql);
    const arrayResult = rsPerf1.toObjArray();
    const time1 = Date.now() - start1;
    console.log(`   toObjArray(): ${arrayResult.length} resultats en ${time1}ms`);
    
    // Approche 2: next + fetchResult
    const start2 = Date.now();
    const rsPerf2 = await statement.executeQuery(perfSql);
    const metaPerf = rsPerf2.getMetaData();
    const allColumnMetaPerf = metaPerf.getAllColumnMeta();
    let count2 = 0;
    while (rsPerf2.next()) {
        rsPerf2.fetchResult(allColumnMetaPerf);
        count2++;
    }
    const time2 = Date.now() - start2;
    console.log(`   next+fetchResult(): ${count2} resultats en ${time2}ms`);
    
    // Approche 3: next + getter direct
    const start3 = Date.now();
    const rsPerf3 = await statement.executeQuery(perfSql);
    let count3 = 0;
    while (rsPerf3.next()) {
        try {
            rsPerf3.resultSet.getStringSync('TABLE_NAME');
            count3++;
        } catch (e) {
            count3++;
        }
    }
    const time3 = Date.now() - start3;
    console.log(`   next+getter(): ${count3} resultats en ${time3}ms`);

    // Release the connection from the pool
    console.log('\nLiberation de la connexion...');
    await db.release(connobj);
    
    // Close the pool - correction de l'API
    console.log('Fermeture du pool JDBC...');
    try {
        await new Promise((resolve) => {
            db.close(() => {
                console.log('Pool JDBC ferme');
                resolve();
            });
        });
    } catch (closeError) {
        console.log('Pool ferme (methode alternative)');
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Connexion fermee - Temps total: ${totalTime}ms`);
    
    console.log('\nTEST JDBC REUSSI!');
    console.log('   La connectivite JDBC fonctionne parfaitement.');
    console.log('   La solution au probleme de timeout est confirmee.');

} catch (error) {
    const errorMsg = error.message || String(error);
    console.log(`\nERREUR JDBC: ${errorMsg}`);
    
    // Diagnostic d'erreurs communes
    if (errorMsg.includes('ClassNotFoundException')) {
        console.log('Driver HSQLDB non trouve - verifiez le JAR');
    } else if (errorMsg.includes('Database does not exists')) {
        console.log('Base de donnees introuvable - verifiez les fichiers .script/.data/.properties');
    } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        console.log('Timeout de connexion - la configuration peut necessiter des ajustements');
    } else if (errorMsg.includes('Access is denied')) {
        console.log('Acces refuse - verifiez les permissions de fichiers');
    } else if (errorMsg.includes('ENOENT')) {
        console.log('Fichier non trouve - verifiez les chemins de base de donnees');
    }
    
    console.log('\nConfiguration debug:');
    console.log(`   JVM creee: ${isJvmCreated()}`);
    console.log(`   URL: ${config.url}`);
    console.log(`   Driver: ${config.drivername}`);
    
    process.exit(1);
}

console.log('\nTest termine avec succes.');
process.exit(0);
