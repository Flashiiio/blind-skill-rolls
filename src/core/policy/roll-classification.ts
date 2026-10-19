export interface RollMetadata {
  type: string | null;
  skill: string | null;
  ability: string | null;
  tool: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function id(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
}

export function getRollMetadata(message: unknown): RollMetadata {
  const source = record(message);
  const system = record(source.system);
  // dnd5e 6 uses typed ChatMessages; flags remain relevant for existing world messages.
  if (typeof source.type === "string" && source.type !== "base") {
    const skill = id(system.skill);
    const tool = id(system.tool);
    let type = source.type;
    if (type === "save" && system.type === "death") type = "death";
    else if (type === "check") type = skill ? "skill" : tool ? "tool" : system.type === "initiative" ? "initiative" : "check";
    return { type, skill, tool, ability: id(system.ability) };
  }

  const d5 = record(record(source.flags).dnd5e);
  const roll = record(d5.roll);
  const context = record(roll.context ?? d5.context);
  const skill = id(roll.skillId, roll.skill, d5.skillId, d5.skill, context.skill);
  return {
    type: skill ? "skill" : id(roll.type, d5.type, d5.rollType),
    skill,
    ability: id(roll.abilityId, roll.ability, d5.abilityId, d5.ability, context.ability),
    tool: id(roll.tool, d5.tool, context.tool)
  };
}

export function isDeathSaveMessage(message: unknown): boolean {
  return getRollMetadata(message).type === "death" || record(message).flavor === "Death Saving Throw";
}
