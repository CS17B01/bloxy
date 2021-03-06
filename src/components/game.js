import Board from './board';
import Block from './block';
import { LEVELS } from './constants';
import * as THREE from 'three';

const KEYDOWN_EVENTS = [
  "ArrowLeft",
  "ArrowUp",
  "ArrowRight",
  "ArrowDown"
];

class Game {
  constructor() {
    // 3D rendering
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);
    this.camera.rotation.x = -Math.PI/5;
    this.light = new THREE.PointLight(0xffffff, 1.5);
    this.scene.add(this.light);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0xffffff);
    this.renderer.setSize(1000, 500);
    document.body.appendChild(this.renderer.domElement);

    // Game statistics
    this.level = 0;
    this.moves = 0;
    this.movesThisLevel = 0;
    this.scoreboard = document.querySelector(".scoreboard");
    this.modal = document.querySelector(".reset-modal-container");

    // if one coord of the block has already won/lost the level, the other coord
    // will not be checked
    this.checkNextCoord = true;

    // Game components
    this.board = new Board(this.scene, LEVELS[this.level].board);
    this.block = new Block(this.scene, LEVELS[this.level].startPosition);

    // store hit activators so their bridges can be reset on a level reset
    this.activators = [];

    this.handleKeydown = this.handleKeydown.bind(this);

    const modalBtn = document.querySelector(".modal-btn");
    modalBtn.addEventListener('click', () => this.reset());

    // the about modal
    const aboutModal = document.querySelector(".about-modal-container");
    const aboutModalClose = document.querySelector(".about-modal-btn");
    const aboutModalOpen = document.querySelector(".open-about-btn");
    aboutModalOpen.addEventListener('click', () => aboutModal.style.display = "flex");
    aboutModalClose.addEventListener('click', () => aboutModal.style.display = "none");

    this.renderLevel();
  }

  renderLevel() {
    this.board.addBoardToScene();

    const { cameraPosition } = LEVELS[this.level];
    this.camera.position.x = cameraPosition.x;
    this.camera.position.y = cameraPosition.y;
    this.camera.position.z = cameraPosition.z;

    const { x, y, z } = LEVELS[this.level].lightPosition;
    this.light.position.set(x, y, z)

    this.renderer.render(this.scene, this.camera);

    this.dropBlock(140);
  }

  dropBlock(targetHeight) {
    if (this.block.height() > targetHeight) {
      requestAnimationFrame(() => this.dropBlock(targetHeight));
      this.block.drop();
      this.block.addBlockToScene();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.listenKeydown(); // event listeners
    }
  }

  updateScore(newScore) {
    this.movesThisLevel = typeof newScore === "number" ? newScore : this.movesThisLevel + 1;
    this.scoreboard.innerHTML = this.moves + this.movesThisLevel;

    if (typeof newScore === "undefined") {
        this.block.coords.forEach(coord => this.receiveMove(...coord));
    }
  }

  unlistenKeydown() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  listenKeydown() {
    document.addEventListener('keydown', this.handleKeydown);
  }

  handleKeydown(e) {
    switch(e.key) {
      case "ArrowLeft":
        this.block.rotate(0, 0, Math.PI/2);
        this.block.move(-1, 0, 0);
        break;
      case "ArrowUp":
        this.block.rotate(Math.PI/2, 0, 0);
        this.block.move(0, 0, -1);
        break;
      case "ArrowRight":
        this.block.rotate(0, 0, -Math.PI/2);
        this.block.move(1, 0, 0);
        break;
      case "ArrowDown":
        this.block.rotate(-Math.PI/2, 0, 0);
        this.block.move(0, 0, 1);
        break;
      default:
        return;
    }

    if (KEYDOWN_EVENTS.includes(e.key)) {
      this.updateScore();
      this.block.addBlockToScene();
      this.renderer.render(this.scene, this.camera);
    }
  }

  receiveMove(x, z) {
    if (!this.checkNextCoord) {
      this.checkNextCoord = true;
      return;
    }

    const tiles = this.board.tiles;
    const tile = (tiles[z] && tiles[z][x]) ? tiles[z][x] : tiles[1][1];

    switch(tile.type) {
      case "normal":
        break;
      case "empty":
        this.lose();
        break;
      case "goal":
        if (this.block.alignment === "y") this.win();
        break;
      case "bridge":
        if (!tile.isActivated) this.lose();
        break;
      case "activator":
        this.activators.push(tile);
        tile.bridgeCoords.forEach(coord => {
          const bridgeTile = this.board.tiles[coord[0]][coord[1]];
          bridgeTile.removeTileFromScene();

          const wasActivated = bridgeTile.isActivated;
          bridgeTile.isActivated = !wasActivated;
          bridgeTile.renderTile(!wasActivated);
          bridgeTile.addTileToScene();
        });
        this.renderer.render(this.scene, this.camera);

        if (this.block.alignment === "y") this.checkNextCoord = false;
        break;
      case "fragile":
        if (this.block.alignment === "y") this.lose();
        break;
      default:
        return;
    }
  }

  win() {
    this.checkNextCoord = false;
    this.unlistenKeydown();
    this.dropBlock(-1600);
    this.moves += this.movesThisLevel;
    this.activators = [];
    this.updateScore(0);
    setTimeout(this.startNextLevel.bind(this), 1500);
  }

  startNextLevel() {
    this.checkNextCoord = true;

    // next level
    this.level += 1;

    if (this.level === 6) {
      this.modal.style.display = "flex";
    } else {
      this.block.initialPos = LEVELS[this.level].startPosition;
      this.block.startLevel();
      this.board.removeBoardFromScene();

      this.board.tiles = this.board.createTiles(this.scene, LEVELS[this.level].board);
      this.renderLevel();
    }
  }

  lose() {
    this.checkNextCoord = false;
    this.unlistenKeydown();
    this.dropBlock(-1600);
    setTimeout(() => {
      this.updateScore(0);
      this.block.reset();
      this.block.addBlockToScene();
      this.checkNextCoord = true;

      this.activators.forEach(activator => {
        activator.bridgeCoords.forEach(coord => {
          const bridgeTile = this.board.tiles[coord[0]][coord[1]];
          bridgeTile.isActivated = false;
          bridgeTile.removeTileFromScene();
        });
      });

      this.renderer.render(this.scene, this.camera);
    }, 1500);
  }

  reset() {
    this.modal.style.display = "none";
    this.level = -1;
    this.moves = 0;
    this.movesThisLevel = 0;
    this.scoreboard.innerHTML = this.moves;
    this.startNextLevel();
  }
}

export default Game;
