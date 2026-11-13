"""Modèle d'un processus BPMN : couloirs (lanes), nœuds placés sur une grille, flux."""
from dataclasses import dataclass, field


@dataclass
class Node:
    id: str
    kind: str      # start | end | error | task | gateway
    label: str
    lane: str
    col: int


@dataclass
class Process:
    slug: str
    title: str
    lanes: list                      # [(id, libellé, rôle)]
    nodes: dict = field(default_factory=dict)
    flows: list = field(default_factory=list)   # (src, dst, libellé)

    def _add(self, kind, id, label, lane, col):
        assert id not in self.nodes, f"{self.slug}: id en double {id}"
        assert lane in [l[0] for l in self.lanes], f"{self.slug}: couloir inconnu {lane}"
        assert not any(n.lane == lane and n.col == col for n in self.nodes.values()), \
            f"{self.slug}: case occupée {lane}/{col}"
        self.nodes[id] = Node(id, kind, label, lane, col)

    def start(self, id, label, lane, col): self._add("start", id, label, lane, col)
    def end(self, id, label, lane, col): self._add("end", id, label, lane, col)
    def error(self, id, label, lane, col): self._add("error", id, label, lane, col)
    def task(self, id, label, lane, col): self._add("task", id, label, lane, col)
    def gw(self, id, label, lane, col): self._add("gateway", id, label, lane, col)

    def flow(self, a, b, label=""):
        self.flows.append((a, b, label))

    def chain(self, *ids):
        for a, b in zip(ids, ids[1:]):
            self.flow(a, b)
