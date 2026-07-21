import { Plane, PerspectiveCamera, Raycaster, Spherical, Vector2, Vector3 } from "three";
import type { FrameContext, Vec2, Vec3 } from "../app/contracts";

export type CameraBounds = {
  radius: readonly [number, number];
  polarAngle: readonly [number, number];
};

const INITIAL_POSITION = new Vector3(5.8, 3.2, 8.6);
const CAMERA_TARGET = new Vector3(0, 0.4, 0);
const CORE_POSITION = new Vector3(0, 0, 0);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export class CameraController {
  private readonly camera: PerspectiveCamera;
  private readonly bounds: CameraBounds;
  private readonly reducedMotion: boolean;
  private readonly raycaster = new Raycaster();
  private readonly spherical = new Spherical();
  private thetaVelocity = 0;
  private polarVelocity = 0;
  private radiusVelocity = 0;

  constructor(camera: PerspectiveCamera, bounds: CameraBounds, reducedMotion: boolean) {
    this.camera = camera;
    this.bounds = bounds;
    this.reducedMotion = reducedMotion;
    this.reset();
  }

  update(frame: FrameContext): void {
    if (frame.interaction.resetRequested) {
      this.reset();
      return;
    }

    const [orbitTheta, orbitPolar] = frame.interaction.orbitDelta;
    const useReducedMotion = this.reducedMotion || frame.interaction.reducedMotion;
    if (useReducedMotion) {
      this.spherical.theta += orbitTheta;
      this.spherical.phi += orbitPolar;
      this.spherical.radius += frame.interaction.zoomDelta;
      this.thetaVelocity = 0;
      this.polarVelocity = 0;
      this.radiusVelocity = 0;
    } else {
      this.thetaVelocity += orbitTheta;
      this.polarVelocity += orbitPolar;
      this.radiusVelocity += frame.interaction.zoomDelta;
      this.spherical.theta += this.thetaVelocity;
      this.spherical.phi += this.polarVelocity;
      this.spherical.radius += this.radiusVelocity;
      const damping = Math.exp(-frame.deltaSeconds * 10);
      this.thetaVelocity *= damping;
      this.polarVelocity *= damping;
      this.radiusVelocity *= damping;
    }

    this.constrainAndApply();
  }

  projectPointer(pointerNdc: Vec2): Vec3 {
    this.camera.updateMatrixWorld();
    const normal = this.camera.position.clone().sub(CORE_POSITION).normalize();
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, CORE_POSITION);
    this.raycaster.setFromCamera(new Vector2(pointerNdc[0], pointerNdc[1]), this.camera);
    const intersection = this.raycaster.ray.intersectPlane(plane, new Vector3());
    if (intersection === null) return [0, 0, 0];
    return [intersection.x, intersection.y, intersection.z];
  }

  private reset(): void {
    this.spherical.setFromVector3(INITIAL_POSITION);
    this.thetaVelocity = 0;
    this.polarVelocity = 0;
    this.radiusVelocity = 0;
    this.camera.position.copy(INITIAL_POSITION);
    this.camera.lookAt(CAMERA_TARGET);
    this.camera.updateMatrixWorld();
  }

  private constrainAndApply(): void {
    this.spherical.radius = clamp(this.spherical.radius, this.bounds.radius[0], this.bounds.radius[1]);
    this.spherical.phi = clamp(this.spherical.phi, this.bounds.polarAngle[0], this.bounds.polarAngle[1]);
    this.camera.position.setFromSpherical(this.spherical);
    this.camera.lookAt(CAMERA_TARGET);
    this.camera.updateMatrixWorld();
  }
}
