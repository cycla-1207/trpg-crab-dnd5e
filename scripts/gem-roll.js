// ============================================================
// 宝石ロール要求 受信処理
// Foundry VTT V13 / dnd5e 5.x
// ============================================================

Hooks.on("createChatMessage", async message => {
  const request =
    message.getFlag(
      "world",
      "gemRollRequest"
    );

  if (!request) return;

  // 指定されたユーザー以外は何もしない
  if (
    game.user.id !==
    request.userId
  ) {
    return;
  }

  const {
    actorUuid,
    actorName,
    requestId
  } = request;

  // ============================================================
  // Actor取得
  // ============================================================

  const actor =
    await fromUuid(actorUuid);

  if (!actor) {
    ui.notifications.error(
      `宝石を受け取るActor「${actorName}」が見つかりません。`
    );
    return;
  }

  // ============================================================
  // ダイアログ
  // ============================================================

  const requestLabel =
    request.random
      ? "ランダム宝石"
      : `${Number(request.basePrice).toLocaleString()}gp級の宝石`;

  const result =
    await foundry.applications.api.DialogV2.wait({
      window: {
        title: "宝石を獲得"
      },

      content: `
        <div style="
          text-align:center;
          padding:0.5em;
        ">
          <p>
            <strong>${actor.name}</strong> は
            <strong>${requestLabel}</strong>
            を獲得します。
          </p>

          <p>
            ロールして宝石を決定してください。
          </p>
        </div>
      `,

      buttons: [
        {
          action: "roll",
          label: "宝石をロールする",
          icon: "fa-solid fa-dice-d20",
          default: true
        }
      ],

      close: () => null
    });

  if (result !== "roll") return;

  // ============================================================
  // RollTable名
  // ============================================================

  const TABLE_NAMES = {
    50: "50gp級宝石表",
    100: "100gp級宝石表",
    250: "250gp級宝石表",
    500: "500gp級宝石表",
    1000: "1,000gp級宝石表",
    2500: "2,500gp級宝石表",
    5000: "5,000gp級宝石表"
  };

  // ============================================================
  // 価格帯決定
  // ============================================================

  let basePrice;
  let tableName;

  let priceRoll = null;

  if (request.random) {
    // ----------------------------------------------------------
    // 完全ランダム
    //
    // 1-10   : 50gp
    // 11-30  : 100gp
    // 31-55  : 250gp
    // 56-75  : 500gp
    // 76-85  : 1,000gp
    // 86-93  : 2,500gp
    // 94-100 : 5,000gp
    // ----------------------------------------------------------

    priceRoll =
      await new Roll("1d100").evaluate();

    const r =
      priceRoll.total;

    if (r <= 10) {
      basePrice = 50;
    }
    else if (r <= 30) {
      basePrice = 100;
    }
    else if (r <= 55) {
      basePrice = 250;
    }
    else if (r <= 75) {
      basePrice = 500;
    }
    else if (r <= 85) {
      basePrice = 1000;
    }
    else if (r <= 93) {
      basePrice = 2500;
    }
    else {
      basePrice = 5000;
    }

    tableName =
      TABLE_NAMES[basePrice];
  }
  else {
    // ----------------------------------------------------------
    // GM指定
    // ----------------------------------------------------------

    basePrice =
      Number(request.basePrice);

    tableName =
      request.tableName;
  }

  // ============================================================
  // RollTable取得
  // ============================================================

  const tablePackId = "trpg-crab-dnd5e.rolltables";
  const tablePack = game.packs.get(tablePackId);

  if (!tablePack || tablePack.documentName !== "RollTable") {
    ui.notifications.error(
      `宝石ロール表辞典「${tablePackId}」が見つかりません。TRPG部モジュールが有効か確認してください。`
    );
    return;
  }

  let table;

  try {
    const tableIndex = await tablePack.getIndex({
      fields: ["name"]
    });
    const tableEntry = tableIndex.find(
      entry => entry.name === tableName
    );

    if (!tableEntry) {
      ui.notifications.error(
        `辞典「${tablePackId}」にロール表「${tableName}」が見つかりません。`
      );
      return;
    }

    table = await tablePack.getDocument(tableEntry._id);
  }
  catch (err) {
    console.error("Gem Roll | RollTable取得失敗", err);
    ui.notifications.error(
      `ロール表「${tableName}」を読み込めませんでした。辞典「${tablePackId}」の閲覧権限を確認してください。`
    );
    return;
  }

  if (!table) {
    ui.notifications.error(
      `辞典「${tablePackId}」のロール表「${tableName}」を取得できませんでした。`
    );
    return;
  }

  // ============================================================
  // 宝石種類ロール
  // ============================================================

  const draw =
    await table.draw({
      displayChat: false
    });

  const tableResult =
    draw.results?.[0];

  if (!tableResult) {
    ui.notifications.error(
      "宝石の抽選に失敗しました。"
    );
    return;
  }

  // ============================================================
  // 宝石Item取得：TRPG部UUIDを優先し、名前の完全一致へフォールバック
  // ============================================================

  const itemPackIds = [
    "trpg-crab-dnd5e.items",
    "trpg-crab-dnd5e.gems"
  ];
  const gemName = tableResult.name;
  const gemUuid = tableResult.documentUuid;
  let gem = null;

  if (
    typeof gemUuid === "string" &&
    gemUuid.startsWith("Compendium.trpg-crab-dnd5e.")
  ) {
    try {
      const candidate = await fromUuid(gemUuid);
      if (candidate?.documentName === "Item" && candidate.name === gemName) {
        gem = candidate;
      }
    }
    catch (err) {
      console.warn("Gem Roll | TRPG部UUIDからのItem取得失敗", gemUuid, err);
    }
  }

  // itemsで見つからない場合は、宝石素材辞典gemsも完全一致で検索
  for (const itemPackId of itemPackIds) {
    if (gem) break;
    const itemPack = game.packs.get(itemPackId);
    if (!itemPack || itemPack.documentName !== "Item") continue;

    try {
      const itemIndex = await itemPack.getIndex({ fields: ["name"] });
      const itemEntry = itemIndex.find(entry => entry.name === gemName);
      if (!itemEntry) continue;

      const candidate = await itemPack.getDocument(itemEntry._id);
      if (candidate?.documentName === "Item" && candidate.name === gemName) {
        gem = candidate;
      }
    }
    catch (err) {
      console.error("Gem Roll | Item辞典からの取得失敗", itemPackId, gemName, err);
    }
  }

  if (!gem) {
    console.error(
      "Gem Roll | Item取得失敗",
      tableResult
    );

    ui.notifications.error(
      `宝石Item「${tableResult.name}」を取得できませんでした。`
    );

    return;
  }

  // ============================================================
  // 品質ロール
  // ============================================================

const qualityRoll =
  await new Roll("2d6").evaluate();

const QUALITY_MULTIPLIERS = {
  2: 0.5,
  3: 0.6,
  4: 0.7,
  5: 0.8,
  6: 0.9,
  7: 1.0,
  8: 1.1,
  9: 1.2,
  10: 1.4,
  11: 1.7,
  12: 2.0
};

const multiplier =
  QUALITY_MULTIPLIERS[qualityRoll.total];

let price =
  basePrice * multiplier;

  // ------------------------------------------------------------
  // 価格丸め
  // ------------------------------------------------------------

  if (price < 100) {
    price =
      Math.round(
        price / 5
      ) * 5;
  }
  else if (price < 1000) {
    price =
      Math.round(
        price / 10
      ) * 10;
  }
  else {
    price =
      Math.round(
        price / 50
      ) * 50;
  }

  // ============================================================
  // 品質名
  // ============================================================

  const QUALITY_NAMES = {
    2: "傷物",
    3: "低品質",
    4: "やや低品質",
    5: "並",
    6: "並",
    7: "良質",
    8: "良質",
    9: "上質",
    10: "上質",
    11: "極上",
    12: "稀代"
  };

  const qualityName =
    QUALITY_NAMES[
      qualityRoll.total
    ] ?? "不明";

  // ============================================================
  // Item複製
  // ============================================================

  const itemData =
    gem.toObject();

  delete itemData._id;

  itemData.folder = null;

  if (itemData._stats) {
    itemData._stats.compendiumSource =
      null;

    itemData._stats.duplicateSource =
      null;

    itemData._stats.exportSource =
      null;
  }

  // ------------------------------------------------------------
  // 評価額をItem価格へ反映
  // ------------------------------------------------------------

  itemData.system.price.value =
    price;

  itemData.system.price.denomination =
    "gp";

  itemData.system.quantity =
    1;

  // ------------------------------------------------------------
  // 品質情報を説明欄へ追記
  // ------------------------------------------------------------

  const oldDescription =
    itemData.system.description?.value ?? "";

  itemData.system.description = {
    ...itemData.system.description,

    value: `
      ${oldDescription}

      <hr>

      <p>
        <strong>品質：</strong>${qualityName}<br>
        <strong>品質ロール：</strong>${qualityRoll.total}（2d6）<br>
        <strong>評価額：</strong>${price.toLocaleString()} gp
      </p>
    `
  };

  // ============================================================
  // Actorへ付与
  // ============================================================

  let created;

  try {
    [created] =
      await actor.createEmbeddedDocuments(
        "Item",
        [itemData]
      );
  }
  catch (err) {
    console.error(
      "Gem Roll | Item付与失敗",
      err
    );

    ui.notifications.error(
      "宝石の追加に失敗しました。Actorの編集権限を確認してください。"
    );

    return;
  }

  // ============================================================
  // Dice So Nice
  // ============================================================

  if (game.dice3d) {
    // ランダム時だけ価格帯ダイス表示
    if (priceRoll) {
      await game.dice3d.showForRoll(
        priceRoll,
        game.user,
        true
      );
    }

    await game.dice3d.showForRoll(
      qualityRoll,
      game.user,
      true
    );
  }

  // ============================================================
  // 結果チャットカード
  // ============================================================

  await ChatMessage.create({
    speaker:
      ChatMessage.getSpeaker({
        actor
      }),

    content: `
      <div style="
        border:1px solid var(--color-border-light-primary);
        border-radius:6px;
        overflow:hidden;
        background:rgba(0,0,0,0.08);
      ">

        <div style="
          display:flex;
          align-items:center;
          gap:8px;
          padding:8px 10px;
          border-bottom:1px solid var(--color-border-light-primary);
        ">

          <img
            src="${created.img}"
            width="40"
            height="40"
            style="
              flex:0 0 40px;
              border:none;
              border-radius:4px;
              object-fit:cover;
            "
          >

          <div style="
            min-width:0;
          ">

            <div style="
              font-size:1.05em;
              font-weight:bold;
              line-height:1.2;
              overflow-wrap:anywhere;
            ">
              ${created.name}
            </div>

            <div style="
              font-size:0.85em;
              opacity:0.75;
              margin-top:2px;
            ">
              ${actor.name} が獲得
            </div>

          </div>

        </div>

        <div style="
          padding:8px 10px;
          display:grid;
          grid-template-columns:auto 1fr;
          gap:4px 10px;
          align-items:center;
        ">

          <strong>品質</strong>

          <span>
            ${qualityName}
            <span style="
              opacity:0.7;
            ">
              （2d6 = ${qualityRoll.total}）
            </span>
          </span>

          <strong>評価額</strong>

          <span style="
            font-size:1.1em;
            font-weight:bold;
          ">
            ${price.toLocaleString()} gp
          </span>

        </div>

      </div>
    `
  });

  ui.notifications.info(
    `${created.name}（${price.toLocaleString()}gp）を獲得しました。`
  );
});
