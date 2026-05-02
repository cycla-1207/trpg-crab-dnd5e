Hooks.once("scenePackerReady", async (ScenePacker) => {

  ScenePacker.Initialise({

    moduleName: "trpg-crab-dnd5e",

    adventureName: "かにTRPG部(D&D5e)",

    welcomeJournal: "trpg-crab-dnd5e.journals",

    allowImportPrompts: false,

    /*
     * Scene
     */
    scenePacks: [
      "trpg-crab-dnd5e.scenes"
    ],

    /*
     * Journal
     */
    journalPacks: [
      "trpg-crab-dnd5e.journals"
    ],

    /*
     * Actor
     */
    creaturePacks: [
      "trpg-crab-dnd5e.actors"
    ],

    /*
     * Item
     */
    itemPacks: [
      "trpg-crab-dnd5e.items"
    ],

    /*
     * RollTable
     */
    rollTablePacks: [
      "trpg-crab-dnd5e.rolltables"
    ],

    /*
     * 依存パック
     */
    additionalModulePacks: [
      "trpg-crab-dnd5e",
      "dnd5e"
    ],

    /*
     * UUIDリンク修正
     */
    fixUpRelationships: true,

    /*
     * Compendium Import時に自動関連読み込み
     */
    importAll: true,

    /*
     * Import時に依存Actor/Itemも読む
     */
    importRelated: true

  });

});