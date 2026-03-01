/**
 * hand-interaction.js
 * WebXR hand-tracking pinch-to-grab interaction for the bubble sphere.
 * Supports both bare hands (Quest hand tracking) and controllers (squeeze/trigger).
 */

import * as THREE from 'three';

// ─── Configuration ───────────────────────────────────────────────────────
const PINCH_THRESHOLD = 0.035;      // metres — thumb-index distance to start grab
const PINCH_RELEASE   = 0.055;      // metres — distance to release
const GRAB_RADIUS     = 0.50;       // metres — max distance from hand to sphere centre to initiate grab
const CONTROLLER_GRAB_RADIUS = 0.50;

// ─── State ───────────────────────────────────────────────────────────────
let _isGrabbing = false;
let _grabOffset = new THREE.Vector3();
let _grabbingSource = null;           // the XRInputSource currently grabbing

// Reusable vectors (no alloc in render loop)
const _thumbPos   = new THREE.Vector3();
const _indexPos   = new THREE.Vector3();
const _midPinch   = new THREE.Vector3();
const _spherePos  = new THREE.Vector3();
const _controllerPos = new THREE.Vector3();

/**
 * Call once per XR frame from the render loop.
 *
 * @param {XRFrame}          frame
 * @param {XRReferenceSpace} refSpace
 * @param {THREE.Group}      sphereGroup — the bubble-sphere group to grab/move
 */
export function updateHandInteraction(frame, refSpace, sphereGroup) {
  if (!frame || !refSpace || !sphereGroup) return;

  const session = frame.session;
  if (!session) return;

  sphereGroup.getWorldPosition(_spherePos);

  // Check all input sources (hands + controllers)
  for (const source of session.inputSources) {
    // ── Hand tracking path ──────────────────────────────────────────────
    if (source.hand) {
      _handleHand(frame, refSpace, source, sphereGroup);
      continue;
    }

    // ── Controller path (squeeze / trigger) ─────────────────────────────
    if (source.gripSpace) {
      _handleController(frame, refSpace, source, sphereGroup);
    }
  }
}

/**
 * Whether the sphere is currently being grabbed.
 */
export function isGrabbing() {
  return _isGrabbing;
}

// ─── Hand tracking grab ─────────────────────────────────────────────────
function _handleHand(frame, refSpace, source, sphereGroup) {
  const hand = source.hand;

  const thumbJoint = hand.get('thumb-tip');
  const indexJoint = hand.get('index-finger-tip');
  if (!thumbJoint || !indexJoint) return;

  const thumbPose = frame.getJointPose(thumbJoint, refSpace);
  const indexPose = frame.getJointPose(indexJoint, refSpace);
  if (!thumbPose || !indexPose) return;

  _thumbPos.set(
    thumbPose.transform.position.x,
    thumbPose.transform.position.y,
    thumbPose.transform.position.z
  );
  _indexPos.set(
    indexPose.transform.position.x,
    indexPose.transform.position.y,
    indexPose.transform.position.z
  );

  const pinchDist = _thumbPos.distanceTo(_indexPos);
  _midPinch.lerpVectors(_thumbPos, _indexPos, 0.5);

  if (_isGrabbing && _grabbingSource === source) {
    // Currently grabbing with this hand
    if (pinchDist > PINCH_RELEASE) {
      // Release
      _isGrabbing = false;
      _grabbingSource = null;
      console.log('[Hand] Pinch released');
    } else {
      // Move sphere to follow hand + offset
      sphereGroup.position.copy(_midPinch).add(_grabOffset);
    }
  } else if (!_isGrabbing && pinchDist < PINCH_THRESHOLD) {
    // Check if pinch is near the sphere
    const distToSphere = _midPinch.distanceTo(_spherePos);
    if (distToSphere < GRAB_RADIUS) {
      _isGrabbing = true;
      _grabbingSource = source;
      _grabOffset.copy(sphereGroup.position).sub(_midPinch);
      console.log('[Hand] Pinch grab started, dist:', distToSphere.toFixed(3));
    }
  }
}

// ─── Controller grab (squeeze button) ───────────────────────────────────
function _handleController(frame, refSpace, source, sphereGroup) {
  const gripPose = frame.getPose(source.gripSpace, refSpace);
  if (!gripPose) return;

  _controllerPos.set(
    gripPose.transform.position.x,
    gripPose.transform.position.y,
    gripPose.transform.position.z
  );

  // Use squeeze (grip) button, fall back to trigger (select)
  const squeezed = source.gamepad?.buttons?.[1]?.pressed ?? false;
  const triggered = source.gamepad?.buttons?.[0]?.pressed ?? false;
  const grabbing = squeezed || triggered;

  if (_isGrabbing && _grabbingSource === source) {
    if (!grabbing) {
      _isGrabbing = false;
      _grabbingSource = null;
      console.log('[Controller] Grip released');
    } else {
      sphereGroup.position.copy(_controllerPos).add(_grabOffset);
    }
  } else if (!_isGrabbing && grabbing) {
    const distToSphere = _controllerPos.distanceTo(_spherePos);
    if (distToSphere < CONTROLLER_GRAB_RADIUS) {
      _isGrabbing = true;
      _grabbingSource = source;
      _grabOffset.copy(sphereGroup.position).sub(_controllerPos);
      console.log('[Controller] Grip grab started, dist:', distToSphere.toFixed(3));
    }
  }
}
