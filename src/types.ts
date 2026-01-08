// ============================================
// Primitive Types
// ============================================

export interface float2 {
  x: number;
  y: number;
}

export interface float3 {
  x: number;
  y: number;
  z: number;
}

export interface float4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface floatQ {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface color {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ============================================
// Field Types (wrapped primitives)
// ============================================

export interface Field<T> {
  id?: string;
  value: T;
}

export type Field_bool = Field<boolean>;
export type Field_int = Field<number>;
export type Field_long = Field<number>;
export type Field_float = Field<number>;
export type Field_double = Field<number>;
export type Field_string = Field<string>;
export type Field_float2 = Field<float2>;
export type Field_float3 = Field<float3>;
export type Field_float4 = Field<float4>;
export type Field_floatQ = Field<floatQ>;
export type Field_color = Field<color>;

// ============================================
// Member Types
// ============================================

export interface Reference {
  id?: string;
  targetId: string | null;
  targetType?: string;
}

export type Member = Field<unknown> | Reference;

// ============================================
// Data Model
// ============================================

export interface Worker {
  id?: string;
  isReferenceOnly?: boolean;
}

export interface Component extends Worker {
  componentType?: string;
  members?: Record<string, Member>;
}

export interface Slot extends Worker {
  parent?: Reference;
  position?: Field_float3;
  rotation?: Field_floatQ;
  scale?: Field_float3;
  isActive?: Field_bool;
  isPersistent?: Field_bool;
  name?: Field_string;
  tag?: Field_string;
  orderOffset?: Field_long;
  components?: Component[];
  children?: Slot[];
}

// ============================================
// Message Types (Requests)
// ============================================

export type MessageType =
  | 'getSlot'
  | 'addSlot'
  | 'updateSlot'
  | 'removeSlot'
  | 'getComponent'
  | 'addComponent'
  | 'updateComponent'
  | 'removeComponent';

export interface Message {
  $type: MessageType;
  messageId: string;
}

export interface GetSlotMessage extends Message {
  $type: 'getSlot';
  slotId: string;
  depth: number;
  includeComponentData: boolean;
}

export interface AddSlotMessage extends Message {
  $type: 'addSlot';
  data: Slot;
}

export interface UpdateSlotMessage extends Message {
  $type: 'updateSlot';
  data: Slot;
}

export interface RemoveSlotMessage extends Message {
  $type: 'removeSlot';
  slotId: string;
}

export interface GetComponentMessage extends Message {
  $type: 'getComponent';
  componentId: string;
}

export interface AddComponentMessage extends Message {
  $type: 'addComponent';
  containerSlotId: string;
  data: Component;
}

export interface UpdateComponentMessage extends Message {
  $type: 'updateComponent';
  data: Component;
}

export interface RemoveComponentMessage extends Message {
  $type: 'removeComponent';
  componentId: string;
}

// ============================================
// Response Types
// ============================================

export type ResponseType = 'response' | 'slotData' | 'componentData';

export interface Response {
  $type: ResponseType;
  sourceMessageId: string;
  success: boolean;
  errorInfo?: string;
}

export interface SlotDataResponse extends Response {
  $type: 'slotData';
  depth: number;
  data: Slot;
}

export interface ComponentDataResponse extends Response {
  $type: 'componentData';
  data: Component;
}

// ============================================
// Helper Types
// ============================================

export interface GetSlotOptions {
  slotId: string;
  depth?: number;
  includeComponentData?: boolean;
}

export interface AddSlotOptions {
  parentId?: string;
  name?: string;
  position?: float3;
  rotation?: floatQ;
  scale?: float3;
  isActive?: boolean;
  isPersistent?: boolean;
  tag?: string;
}

export interface UpdateSlotOptions {
  id: string;
  name?: string;
  position?: float3;
  rotation?: floatQ;
  scale?: float3;
  isActive?: boolean;
  isPersistent?: boolean;
  tag?: string;
}

export interface AddComponentOptions {
  containerSlotId: string;
  componentType: string;
  members?: Record<string, Member>;
}

export interface UpdateComponentOptions {
  id: string;
  members?: Record<string, Member>;
}

export const ROOT_SLOT_ID = 'Root';
