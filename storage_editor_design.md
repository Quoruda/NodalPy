# Storage Editor Node — Design Document

## 1. Problématique actuelle

Le répertoire `storage/` contient 81 dossiers UUID, dont beaucoup sont vides ou contiennent des fichiers orphelins (non-référencés par le graphe actif). Ce "bruit" pollue le stockage et peut causer des erreurs futures.

## 2. Solution : Storage Editor Node

Un nouveau type de nœud dans NodalPy qui permet d'inspecter, nettoyer et gérer le stockage de manière propre.

### 2.1. Concept
Le nœud `StorageEditor` agit comme un outil de diagnostic et de maintenance du système de fichiers de stockage. Il ne fait PAS partie du graphe de calcul principal — c'est un utilitaire exécuté ponctuellement.

### 2.2. Flux d'exécution (Pipeline de nettoyage)

Le nœud suit ces étapes dans l'ordre :

```
┌─────────────────────┐
│ 1. Collecte         │  → Scan du répertoire storage/
│    exhaustive       │     Récupérer tous les UUIDs existants sur disque
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 2. Comparaison      │  → Comparer UUIDs du graphe actif vs stockage
│    Graphe vs        │     Identifier :
│    Stockage         │       - UUIDs orphelins (sur disque, pas dans graphe)
│                     │       - Fichiers orphelins (dans dossier, mais pas liés à un nœud du graphe)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 3. Rapport          │  → Afficher le résultat de l'analyse
│    / Preview        │     - Nombre de dossiers vides
│                     │     - Taille totale perdue
│                     │     - Liste des UUIDs à nettoyer
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 4. Nettoyage sélectif│ → Supprimer uniquement ce qui est sûr :
│    (avec confirmation)  - Dossiers vides
│                     │     - Fichiers orphelins
│                     │     - ⚠️ Ne jamais supprimer un dossier actif !
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 5. Validation       │  → Vérifier qu'aucun nœud du graphe n'a été affecté
│    post-nettoyage   │     Confirmer l'intégrité du stockage restant
└─────────────────────┘
```

### 2.3. Stratégie de nettoyage sûr ("Safe Cleanup")

#### Règle d'or : Jamais supprimer un UUID qui est référencé dans le graphe actif.

**Algorithme :**

1. **Collecter les UUIDs actifs** (ceux présents dans le graphe en cours)
   ```python
   active_uuids = set(node.id for node in current_graph.nodes())
   ```

2. **Scanner le stockage sur disque**
   ```python
   disk_uuids = set(os.listdir(STORAGE_DIR))  # Dossiers existants
   ```

3. **Identifier les UUIDs orphelins** (sur disque mais pas dans le graphe)
   ```python
   orphaned_uuids = disk_uuids - active_uuids
   ```

4. **Pour chaque dossier actif : vérifier les fichiers orphelins**
   ```python
   for uuid in disk_uuids:
       folder_path = os.path.join(STORAGE_DIR, uuid)
       files_in_folder = os.listdir(folder_path)
       
       # Garder uniquement les fichiers référencés par le nœud actuel
       active_files = get_node_files(uuid)  # Depuis la base de données / graphe
       orphaned_files = set(files_in_folder) - set(active_files)
       
       if orphaned_files:
           mark_for_cleanup(folder_path, orphaned_files)
   ```

5. **Nettoyage final** (avec confirmation utilisateur)
   ```python
   for uuid in orphaned_uuids:
       folder = os.path.join(STORAGE_DIR, uuid)
       if not os.listdir(folder):  # Dossier vide — SAFE TO DELETE
           shutil.rmtree(folder)
   
   for folder_path, orphaned_files in files_to_cleanup.items():
       for filename in orphaned_files:
           os.remove(os.path.join(folder_path, filename))
   ```

### 2.4. Fichier de registre (Registry)

Pour éviter de devoir scanner le graphe à chaque exécution, on peut maintenir un petit fichier JSON de "registry" :

**`storage/.registry.json`** (suggéré)
```json
{
    "version": "1.0",
    "last_cleanup": null,
    "active_nodes": {
        "uuid-001": {"status": "active", "files": ["node_abc.png"]},
        "uuid-002": {"status": "deleted"}  // Marked for future cleanup
    }
}
```

Ce fichier serait mis à jour dynamiquement quand un nœud est créé, modifié ou supprimé. Le Storage Editor Node lit ce registre pour un scan ultra-rapide au lieu de scanner le graphe complet.

## 3. Implémentation technique

### 3.1. Emplacement du code
```
NodalPy/
├── back-api/
│   ├── nodes/
│   │   └── storage_editor_node.py    ← Nouveau fichier
│   └── ...
├── front-editor/
│   └── (interface de preview du nettoyage)
└── storage/
    └── .registry.json                ← Optionnel, suggéré
```

### 3.2. API du nœud Storage Editor

**Entrées (Input ports):**
- `config` : Paramètres de nettoyage (mode `scan-only`, `preview`, `clean`)
- `dry_run` : Boolean — true pour simuler sans supprimer

**Sorties (Output ports):**
- `report` : JSON avec le résumé du nettoyage proposé
  ```json
  {
    "total_uuids": 81,
    "active_uuids": 25,
    "orphaned_uuids": 54,
    "empty_folders": 50,
    "orphaned_files": 7,
    "estimated_savings_kb": 12.5,
    "details": {
      "to_delete_uuids": ["uuid-a", "uuid-b"],
      "to_orphan_files": {"uuid-c": ["old_snapshot.png"]}
    }
  }
  ```
- `result` : Statut après nettoyage (`success`, `error`, `aborted`)

### 3.3. Fonctions utilitaires recommandées

```python
# back-api/nodes/storage_editor_node.py
import os
import shutil
import json
from pathlib import Path

STORAGE_ROOT = Path(__file__).parent.parent / ".." / "storage"


def scan_storage() -> dict:
    """Scanne le répertoire storage et retourne un dictionnaire structuré."""
    result = {
        "total_uuids": 0,
        "active_uuids": [],
        "orphaned_uuids": [],
        "empty_folders": [],
        "folders_with_orphan_files": []
    }
    
    if not STORAGE_ROOT.exists():
        return result
    
    for uuid_dir in sorted(STORAGE_ROOT.iterdir()):
        if uuid_dir.is_dir():
            result["total_uuids"] += 1
            files = [f.name for f in uuid_dir.iterdir() if f.is_file()]
            
            if not files:
                result["empty_folders"].append(str(uuid_dir))
            else:
                result["folders_with_orphan_files"].append({
                    "uuid": uuid_dir.name,
                    "files": files
                })
    
    return result


def delete_empty_folders(report: dict) -> int:
    """Supprime les dossiers vides identifiés dans le rapport.
    Retourne le nombre de dossiers supprimés."""
    deleted_count = 0
    
    for folder_path_str in report.get("empty_folders", []):
        try:
            shutil.rmtree(folder_path_str, ignore_errors=True)
            deleted_count += 1
        except Exception as e:
            print(f"Erreur lors de la suppression de {folder_path_str}: {e}")
    
    return deleted_count


def is_node_active(uuid_id: str, graph_nodes: list) -> bool:
    """Vérifie si un UUID correspond à un nœud actif dans le graphe."""
    active_ids = [node.id for node in graph_nodes]
    return uuid_id in active_ids


def safe_cleanup(
    storage_root: Path,
    active_node_uuids: set,
    dry_run: bool = False
) -> dict:
    """Nettoyage sûr du stockage.
    
    Args:
        storage_root: Chemin vers le répertoire storage/
        active_node_uuids: UUIDs actifs (du graphe courant)
        dry_run: Si True, ne fait rien mais retourne ce qui serait supprimé
    
    Returns:
        Dictionnaire de rapport détaillé.
    """
    report = {
        "dry_run": dry_run,
        "orphaned_uuids_deleted": [],
        "orphan_files_removed": [],
        "errors": []
    }
    
    if not storage_root.exists():
        return report
    
    for uuid_dir in sorted(storage_root.iterdir()):
        if not uuid_dir.is_dir():
            continue
        
        # Cas 1: UUID orphelin (pas dans le graphe actif)
        if uuid_dir.name not in active_node_uuids:
            # Vérifier si le dossier est vide
            files = [f for f in uuid_dir.iterdir() if f.is_file()]
            
            if not files:
                # Dossier vide — on peut supprimer en toute sécurité
                report["orphaned_uuids_deleted"].append(str(uuid_dir))
                
                if not dry_run:
                    try:
                        shutil.rmtree(uuid_dir, ignore_errors=True)
                    except Exception as e:
                        report["errors"].append(f"Cannot delete {uuid_dir}: {e}")
            else:
                # Dossier non vide mais UUID orphelin — on garde le dossier
                # mais on supprime les fichiers orphelins
                pass
        
        # Cas 2: UUID actif — vérifier les fichiers orphelins dans le dossier
        else:
            files = [f.name for f in uuid_dir.iterdir() if f.is_file()]
            referenced_files = get_node_referenced_files(uuid_dir.name)
            
            orphaned_in_folder = set(files) - set(referenced_files)
            
            if orphaned_in_folder and not dry_run:
                for filename in orphaned_in_folder:
                    file_path = uuid_dir / filename
                    try:
                        file_path.unlink()
                        report["orphan_files_removed"].append(str(file_path))
                    except Exception as e:
                        report["errors"].append(f"Cannot delete {file_path}: {e}")
    
    return report


# --- Fonctions abstraites (à adapter selon l'architecture de ton graphe) ---

def get_node_referenced_files(uuid_id: str) -> list:
    """Retourne la liste des fichiers référencés par un nœud actif.
    À implémenter selon comment tu stockes les références."""
    # TODO: Adapter cette fonction à ta structure de données
    return []


def get_active_node_uuids() -> set:
    """Retourne les UUIDs des nœuds actifs dans le graphe courant.
    À adapter selon ton implémentation du graphe."""
    # TODO: Adapter cette fonction
    return set()
```

## 4. Interface Frontend (Preview)

Dans `front-editor/`, on peut ajouter un panel latéral "Storage Editor" qui :
1. Affiche un arbre des dossiers de stockage avec les UUIDs
2. Met en évidence les dossiers vides / orphelins
3. Permet de prévisualiser le nettoyage avant exécution
4. Lance le nettoyage via une API call au backend

## 5. Bonnes pratiques supplémentaires

- **Journalisation** : Chaque action de nettoyage est loggée dans un fichier `storage/.cleanup.log` avec timestamp et utilisateur.
- **Rollback** : Avant tout nettoyage, créer une archive temporaire (`storage/.backup-before-cleanup.tar.gz`) pour pouvoir restaurer si besoin.
- **Permission** : Le Storage Editor Node ne doit être accessible qu'aux utilisateurs avec le rôle `admin`.
