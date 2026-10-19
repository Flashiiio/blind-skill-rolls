
// =====================================================================
//  Base Document
// =====================================================================

interface FoundryDocument {
  readonly id: string;
  readonly documentName: string;
  readonly parent: FoundryDocument | null;
  readonly flags: Record<string, Record<string, unknown>>;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<void>;
  unsetFlag(scope: string, key: string): Promise<void>;
  update(data: Record<string, unknown>, context?: Record<string, unknown>): Promise<this>;
}

// =====================================================================
//  Collection
// =====================================================================

interface FoundryCollection<T> {
  get(id: string): T | undefined;
  filter(predicate: (item: T) => boolean): T[];
  map<U>(fn: (item: T) => U): U[];
  find(predicate: (item: T) => boolean): T | undefined;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[string, T]>;
  forEach(fn: (item: T) => void): void;
  readonly size: number;
}

// =====================================================================
//  Document Types
// =====================================================================

interface User extends FoundryDocument {
  readonly name: string;
  readonly isGM: boolean;
  readonly isActiveGM: boolean;
  readonly role: number;
}

interface Actor extends FoundryDocument {
  readonly name: string;
  readonly type: "character" | "npc" | string;
  readonly token: TokenDocument | null;
  readonly isToken: boolean;
  readonly baseActor: Actor | null;
}

interface TokenDocument extends FoundryDocument {
  readonly name: string;
  readonly hidden: boolean;
  readonly actor: Actor | null;
}

interface Speaker {
  actor?: string | null;
  token?: string | null;
  scene?: string | null;
  alias?: string | null;
}

interface ChatMessageRollOptions {
  rollMode?: string;
  skillId?: string;
  skill?: string;
  [key: string]: unknown;
}

interface ChatMessageRoll {
  readonly options: ChatMessageRollOptions;
  readonly data: Record<string, unknown>;
}

interface ChatMessage extends FoundryDocument {
  readonly author: User | null;
  readonly actor: Actor | null;
  readonly blind: boolean;
  readonly whisper: string[];
  readonly rolls: ChatMessageRoll[];
  readonly flavor: string;
  readonly speaker: Speaker;
  updateSource(data: Record<string, unknown>): void;
}

declare class ChatMessageClass {
  static getWhisperRecipients(name: string): User[];
}

interface Scene extends FoundryDocument {
  readonly id: string;
}

interface Combatant extends FoundryDocument {
  readonly token: TokenDocument | null;
  readonly actor: Actor | null;
  readonly name: string;
  readonly sceneId: string | null;
  readonly tokenId: string | null;
  readonly combat: Combat | null;
}

interface Combat extends FoundryDocument {
  readonly combatants: FoundryCollection<Combatant>;
  readonly scene: Scene | null;
}

// =====================================================================
//  Settings
// =====================================================================

interface SettingConfig {
  name?: string;
  hint?: string;
  scope?: "client" | "world";
  config?: boolean;
  restricted?: boolean;
  type?: typeof String | typeof Number | typeof Boolean | typeof Object | typeof Array;
  choices?: Record<string, string>;
  default?: unknown;
  range?: { min: number; max: number; step: number };
  onChange?: (value: unknown) => void;

  readonly namespace?: string;
  readonly key?: string;
}

interface MenuConfig {
  name?: string;
  label?: string;
  hint?: string;
  icon?: string;
  type: new (...args: unknown[]) => unknown;
  restricted?: boolean;
}

interface ClientSettings {
  register(namespace: string, key: string, data: SettingConfig): void;
  registerMenu(namespace: string, key: string, data: MenuConfig): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;

  readonly settings: Map<string, SettingConfig>;
}

// =====================================================================
//  Localization
// =====================================================================

interface Localization {
  localize(key: string): string;
  format(key: string, data?: Record<string, unknown>): string;
  has(key: string, fallback?: boolean): boolean;
  readonly lang: string;
}

// =====================================================================
//  Socket
// =====================================================================

interface FoundrySocket {
  emit(eventName: string, data?: unknown): void;
  on(eventName: string, callback: (...args: unknown[]) => void): void;
}

// =====================================================================
//  Notifications
// =====================================================================

interface Notifications {
  info(message: string, options?: Record<string, unknown>): void;
  warn(message: string, options?: Record<string, unknown>): void;
  error(message: string, options?: Record<string, unknown>): void;
}

// =====================================================================
//  Module
// =====================================================================

interface FoundryModule {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly active: boolean;
  readonly compatibility: { verified?: string; minimum?: string; maximum?: string } | null;
  api?: Record<string, unknown>;
}

// =====================================================================
//  Dice So Nice (Dice3D)
// =====================================================================

interface Dice3D {
  show(
    data: Record<string, unknown>,
    user?: User | null,
    synchronize?: boolean,
    users?: string[] | null,
    blind?: boolean
  ): Promise<boolean>;
  [key: string]: unknown;
}

// =====================================================================
//  Combat Tracker Dock
// =====================================================================

interface CombatDock {
  readonly element: HTMLElement | null;
  readonly rendered: boolean;
  setupCombatants(): void;
  updateCombatants(): void;
  autosize(): void;
  render(force?: boolean): void;
}

// =====================================================================
//  Chat Sidebar
// =====================================================================

interface ChatSidebar {
  readonly element: HTMLElement | null;
  updateMessage?(message: ChatMessage): Promise<void>;
}

// =====================================================================
//  Combat Tracker UI
// =====================================================================

interface CombatTrackerUI {
  render(force?: boolean): void;
}

// =====================================================================
//  Application
// =====================================================================

interface ApplicationInstance {
  readonly element: HTMLElement | null;
  readonly constructor: { name: string };
}

// =====================================================================
//  game
// =====================================================================

interface Game {
  readonly user: User | null;
  readonly users: FoundryCollection<User>;
  readonly settings: ClientSettings;
  readonly i18n: Localization;
  readonly modules: FoundryCollection<FoundryModule>;
  readonly messages: FoundryCollection<ChatMessage>;
  readonly actors: FoundryCollection<Actor>;
  readonly combat: Combat | null;
  readonly system: { readonly id: string; readonly title: string; readonly version: string };
  readonly world: { readonly id: string; readonly title: string };
  readonly version: string;
  readonly socket: FoundrySocket | null;
  readonly dice3d: Dice3D | null;
  readonly build?: string | null;
  readonly release?: Record<string, unknown> | null;
}

declare const game: Game;

// =====================================================================
//  Hooks
// =====================================================================

type HookCallback = (...args: any[]) => void | boolean | Promise<void>;

interface HooksAPI {
  on(hook: string, callback: HookCallback): number;
  once(hook: string, callback: HookCallback): number;
  off(hook: string, idOrCallback: number | HookCallback): void;
  callAll(hook: string, ...args: unknown[]): boolean;
  call(hook: string, ...args: unknown[]): boolean;
}

declare const Hooks: HooksAPI;

// =====================================================================
//  CONST
// =====================================================================

interface FoundryCONST {
  readonly USER_ROLES: {
    readonly NONE: 0;
    readonly PLAYER: 1;
    readonly TRUSTED: 2;
    readonly ASSISTANT: 3;
    readonly GAMEMASTER: 4;
  };
  readonly CHAT_MESSAGE_STYLES: {
    readonly OTHER: 0;
    readonly OOC: 1;
    readonly IC: 2;
    readonly EMOTE: 3;
  };
  readonly DICE_ROLL_MODES: {
    readonly PUBLIC: "publicroll";
    readonly PRIVATE: "gmroll";
    readonly BLIND: "blindroll";
    readonly SELF: "selfroll";
  };
}

declare const CONST: FoundryCONST;

// =====================================================================
//  CONFIG
// =====================================================================

interface DND5ESkillEntry {
  readonly label: string;
  readonly ability: string;
  readonly fullKey?: string;
}

interface DND5EAbilityEntry {
  readonly label: string;
  readonly abbreviation?: string;
  readonly fullKey?: string;
}

interface DND5EConfig {
  readonly skills: Record<string, DND5ESkillEntry>;
  readonly abilities: Record<string, DND5EAbilityEntry>;
  [key: string]: unknown;
}

interface FoundryCONFIG {
  readonly DND5E: DND5EConfig;
  combatTrackerDock?: {
    CombatantPortrait?: new (...args: unknown[]) => unknown;
  };
  [key: string]: unknown;
}

declare const CONFIG: FoundryCONFIG;

// =====================================================================
//  ui
// =====================================================================

interface FoundryUI {
  readonly notifications: Notifications;
  readonly chat: ChatSidebar | null;
  readonly combat: CombatTrackerUI | null;
  readonly combatDock: CombatDock | null;
  readonly windows: Record<number, ApplicationInstance>;
}

declare const ui: FoundryUI;

// =====================================================================
//  canvas
// =====================================================================

interface FoundryCanvas {
  readonly scene: Scene | null;
}

declare const canvas: FoundryCanvas;

// =====================================================================
//  ChatMessage (global class reference)
// =====================================================================

declare const ChatMessage: typeof ChatMessageClass;

// =====================================================================
//  fromUuidSync
// =====================================================================

declare function fromUuidSync(uuid: string, options?: Record<string, unknown>): FoundryDocument | null;

// =====================================================================
//  foundry namespace
// =====================================================================

interface ApplicationV2Options {
  id?: string;
  classes?: string[];
  window?: { title?: string; icon?: string; resizable?: boolean };
  position?: { width?: number | "auto"; height?: number | "auto" };
  actions?: Record<string, (...args: unknown[]) => void | Promise<void>>;
  [key: string]: unknown;
}

interface ApplicationV2Parts {
  [key: string]: { template: string };
}

declare class ApplicationV2Base {
  static DEFAULT_OPTIONS: ApplicationV2Options;
  static PARTS: ApplicationV2Parts;

  readonly element: HTMLElement;
  render(options?: { force?: boolean }): void;
  close(options?: Record<string, unknown>): Promise<void>;

  _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>>;
  _onRender(context: Record<string, unknown>, options: Record<string, unknown>): void;
}

type HandlebarsApplicationMixinReturn = typeof ApplicationV2Base;

interface FormDataExtendedInstance {
  readonly object: Record<string, unknown>;
}

declare namespace foundry {
  namespace applications {
    namespace api {
      const ApplicationV2: typeof ApplicationV2Base;
      function HandlebarsApplicationMixin<T extends abstract new (...args: any[]) => any>(
        base: T
      ): T & HandlebarsApplicationMixinReturn;
    }
    namespace ux {
      class FormDataExtended implements FormDataExtendedInstance {
        constructor(form: HTMLFormElement, options?: Record<string, unknown>);
        readonly object: Record<string, unknown>;
      }
    }
  }

  namespace audio {
    class AudioHelper {
      static play(data: { src: string; volume?: number; loop?: boolean } | string, options?: Record<string, unknown>): Promise<Sound | null>;
    }

    class Sound {
      readonly src: string;
      readonly path: string;
      play(options?: Record<string, unknown>): unknown;
    }
  }
}

// =====================================================================
//  Howler.js globals
// =====================================================================

declare class Howl {
  readonly _src: string | string[];
  play(spriteOrId?: string | number): number;
}

declare class HowlerGlobal {
  _muted: boolean;
  mute(muted: boolean): this;
}

declare const Howler: HowlerGlobal;

// =====================================================================
//  Window augmentation
// =====================================================================

interface Window {
  __BSR_TS_PASSIVE_V3__?: boolean;
}

declare var Howl: {
  new (...args: any[]): Howl;
  prototype: Howl;
} | undefined;

declare var Howler: HowlerGlobal | undefined;

declare var __BSR_TS_PASSIVE_V3__: boolean | undefined;
