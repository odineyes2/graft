/**
 * src/core/systems/nightDraft.ts
 *
 * 밤 해결 중에만 쓰는 가변 작업 사본. RunState의 ReadonlyArray를 매번 새
 * 배열로 복사하지 않고도 개별 엔티티를 갱신할 수 있게 Map으로 감싼다.
 * resolveNight() 안에서만 쓰고, 끝나면 toState()로 순수 RunState를 만든다.
 *
 * 순수 TypeScript — Phaser / DOM / window / localStorage 참조 없음.
 * T-13 산출물.
 */

import type {
  Business,
  BusinessId,
  CrewId,
  CrewMember,
  District,
  DistrictId,
  GangId,
  RivalGang,
  RunState,
} from '../types';
import { clamp } from './actionCheck';

export class NightDraft {
  private readonly districts: Map<DistrictId, District>;
  private readonly businesses: Map<BusinessId, Business>;
  private readonly crew: Map<CrewId, CrewMember>;
  private readonly rivals: Map<GangId, RivalGang>;

  credits: number;
  heat: number;
  reputation: number;

  constructor(private readonly original: RunState) {
    this.districts = new Map(original.districts.map((d) => [d.id, d]));
    this.businesses = new Map(original.businesses.map((b) => [b.id, b]));
    this.crew = new Map(original.crew.map((c) => [c.id, c]));
    this.rivals = new Map(original.rivals.map((r) => [r.id, r]));
    this.credits = original.credits;
    this.heat = original.heat;
    this.reputation = original.reputation;
  }

  getDistrict(id: DistrictId): District {
    const district = this.districts.get(id);
    if (!district) throw new Error(`존재하지 않는 구역: ${id}`);
    return district;
  }

  setDistrict(district: District): void {
    this.districts.set(district.id, district);
  }

  getBusiness(id: BusinessId): Business | undefined {
    return this.businesses.get(id);
  }

  getCrewMember(id: CrewId): CrewMember {
    const crew = this.crew.get(id);
    if (!crew) throw new Error(`존재하지 않는 조직원: ${id}`);
    return crew;
  }

  setCrewMember(crew: CrewMember): void {
    this.crew.set(crew.id, crew);
  }

  getRival(id: GangId): RivalGang | undefined {
    return this.rivals.get(id);
  }

  setRival(rival: RivalGang): void {
    this.rivals.set(rival.id, rival);
  }

  /** 원본 순서를 유지하며 순수 RunState로 되돌린다. */
  toState(): RunState {
    return {
      ...this.original,
      credits: this.credits,
      heat: clamp(this.heat, 0, 100),
      reputation: clamp(this.reputation, 0, 100),
      districts: this.original.districts.map((d) => this.districts.get(d.id) ?? d),
      crew: this.original.crew.map((c) => this.crew.get(c.id) ?? c),
      rivals: this.original.rivals.map((r) => this.rivals.get(r.id) ?? r),
    };
  }
}
