# NodalPy

![Licence MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Python](https://img.shields.io/badge/Python-3.x-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-20-brightgreen.svg)


NodalPy est un outil permettant d’exécuter du code à partir de **nœuds éditables**. Chaque nœud peut être personnalisé avec son propre code, ses variables d’entrée et de sortie, ce qui facilite la création et l’organisation de workflows modulaires.

## 🚀 Installation et Build

### 0. Prérequis

* Python 3 et `pip`
* Node.js 20 et `npm`

Ce projet est compatible avec :

* macOS
* Linux
* Windows

⚠️ Les commandes ci-dessous sont prévues pour **Linux**. Adaptez-les en fonction de votre système d’exploitation.

⚠️ Attention : l’utilisation d’un environnement conda peut causer des problèmes avec le mode fenêtre (desktop). Il est recommandé d’utiliser un environnement virtuel Python standard (venv).

### 1. Cloner le dépôt

```bash
git clone https://github.com/Quoruda/NodalPy.git
cd NodalPy
```

### 2. Compiler le projet

```bash
python3 build.py
```

### 3. Accéder au dossier de build

```bash
cd build/
```

### 4. (Optionnel) Créer un environnement virtuel Python

```bash
python3 -m venv venv
source venv/bin/activate
```

### 5. Installer les dépendances Python

```bash
pip install -r requirements.txt
```

### 6. Lancer l’application

```bash
python3 main.py <mode>
```

Remplacez `<mode>` par l’un des modes disponibles :

* **desktop** → ouvre l’application dans une fenêtre native
* **local** → démarre l’application en mode serveur local, accessible via navigateur

## 📂 Structure du projet

* `build/` → contient la version compilée
* `back-api/` → API Python (backend)
* `front-editor/` → éditeur graphique en React (frontend)
* `build.py` → script Python pour créer le build

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour proposer des améliorations :

1. Forkez le projet
2. Créez une branche (`git checkout -b feature/ma-feature`)
3. Committez vos modifications (`git commit -m 'Ajout d’une nouvelle feature'`)
4. Poussez la branche (`git push origin feature/ma-feature`)
5. Créez une Pull Request

## 📜 Licence

Ce projet est distribué sous la licence **MIT**. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.
