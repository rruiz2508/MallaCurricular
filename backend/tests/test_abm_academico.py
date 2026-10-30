"""Pruebas de validación de los esquemas de carreras, asignaturas, mallas y promociones
(sin base de datos)."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.v1.asignaturas import (
    AsignaturaIn,
    AsignaturaUpdate,
    EquivalenciaIn,
)
from app.api.v1.carreras import CarreraIn, CarreraUpdate
from app.api.v1.mallas import MallaAsignaturaIn, MallaAsignaturaUpdate, MallaIn, RelacionIn
from app.api.v1.promociones import PromocionIn, PromocionUpdate


def test_carrera_recorta_textos_y_rechaza_nulos() -> None:
    carrera = CarreraIn(facultad_id=uuid4(), codigo=" LCI-SI ", nombre=" Licenciatura ")
    assert (carrera.codigo, carrera.nombre) == ("LCI-SI", "Licenciatura")
    with pytest.raises(ValidationError):
        CarreraUpdate(codigo=None)
    # El título y la duración sí pueden vaciarse.
    assert CarreraUpdate(titulo_otorgado=None).model_dump(exclude_unset=True) == {
        "titulo_otorgado": None
    }


def test_asignatura_valida_coherencia_de_horas() -> None:
    AsignaturaIn(
        codigo="A", nombre="A", carga_horaria_total=60, horas_teoricas=30, horas_practicas=30
    )
    with pytest.raises(ValidationError):
        AsignaturaIn(
            codigo="A", nombre="A", carga_horaria_total=60, horas_teoricas=40, horas_practicas=30
        )
    with pytest.raises(ValidationError):
        AsignaturaIn(codigo="A", nombre="A", carga_horaria_total=0)
    with pytest.raises(ValidationError):
        AsignaturaIn(codigo="A", nombre="A", carga_horaria_total=60, estado="otra")  # type: ignore[arg-type]


def test_asignatura_update_rechaza_nulos_obligatorios() -> None:
    for campo in ("codigo", "nombre", "carga_horaria_total", "estado"):
        with pytest.raises(ValidationError):
            AsignaturaUpdate(**{campo: None})
    assert AsignaturaUpdate(codigo_sistema=None).model_dump(exclude_unset=True) == {
        "codigo_sistema": None
    }


def test_equivalencia_no_admite_la_misma_asignatura() -> None:
    mismo = uuid4()
    with pytest.raises(ValidationError):
        EquivalenciaIn(asignatura_id=mismo, equivalente_id=mismo)
    EquivalenciaIn(asignatura_id=uuid4(), equivalente_id=uuid4())


def test_malla_asignatura_semestre_segun_tipo() -> None:
    MallaAsignaturaIn(asignatura_id=uuid4(), semestre=3)
    MallaAsignaturaIn(asignatura_id=uuid4(), tipo="trabajo_final")
    with pytest.raises(ValidationError):
        MallaAsignaturaIn(asignatura_id=uuid4(), tipo="obligatoria")  # falta semestre
    with pytest.raises(ValidationError):
        MallaAsignaturaIn(asignatura_id=uuid4(), semestre=2, tipo="complementaria")


def test_malla_asignatura_update_acepta_semestre_nulo_pero_no_tipo_nulo() -> None:
    assert MallaAsignaturaUpdate(semestre=None, tipo="complementaria").model_dump(
        exclude_unset=True
    ) == {"semestre": None, "tipo": "complementaria"}
    with pytest.raises(ValidationError):
        MallaAsignaturaUpdate(tipo=None)


def test_malla_limites_y_valores_por_defecto() -> None:
    malla = MallaIn(carrera_id=uuid4(), nombre="Malla", duracion_semestres=8)
    assert malla.horas_por_credito == 15
    with pytest.raises(ValidationError):
        MallaIn(carrera_id=uuid4(), nombre="Malla", duracion_semestres=0)


def test_relacion_no_admite_autorreferencia() -> None:
    mismo = uuid4()
    with pytest.raises(ValidationError):
        RelacionIn(asignatura_id=mismo, relacionada_id=mismo)


def test_promocion_defaults_y_nulos() -> None:
    assert PromocionIn(carrera_id=uuid4(), anio=2023, malla_id=uuid4()).anios_gracia == 3
    with pytest.raises(ValidationError):
        PromocionIn(carrera_id=uuid4(), anio=1800, malla_id=uuid4())
    with pytest.raises(ValidationError):
        PromocionUpdate(malla_id=None)
