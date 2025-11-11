from flask import Flask, jsonify, request
import logging
import re
from flask_cors import CORS
import sympy as sp
import numpy as np
import os, sys
# Asegurar que el directorio raíz del proyecto esté en sys.path para importar 'backend'
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
from backend.math_operations import (
    calculate_partials,
    calculate_gradient,
    evaluate_function,
    calculate_double_integral,
    lagrange_method,
    calculate_unconstrained_optimization,
)

# Aplicación Flask principal para el backend del proyecto de cálculo multivariable.
# Los comentarios están en español para explicar cada parte del código.

def create_app():
    # Crea y configura la aplicación Flask
    app = Flask(__name__)

    # Habilita CORS para permitir solicitudes del frontend (todos los orígenes por defecto)
    CORS(app)

    # Configura logging básico para registrar solicitudes y errores
    # Los logs ayudan a depurar y monitorear el uso del API
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    logger = logging.getLogger(__name__)
    # Variables simbólicas para construir LaTeX
    x, y = sp.symbols('x y')

    # Validador de expresiones: solo permite tokens de funciones conocidas y variables x, y
    # Previene que el usuario envíe código malicioso o nombres peligrosos
    allowed_tokens = {
        'x', 'y',
        # Trigonométricas básicas e inversas
        'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
        'csc', 'sec', 'cot', 'acsc', 'asec', 'acot',
        # Hiperbólicas e inversas
        'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
        'csch', 'sech', 'coth',
        # Otras funciones
        'exp', 'log', 'sqrt', 'abs',
        # Constantes
        'pi', 'E'
    }

    def validate_expression(expr: str):
        # Verifica que la entrada sea cadena y no contenga patrones peligrosos
        if not isinstance(expr, str):
            return False, 'Expression must be a string'
        lowered = expr.lower()
        forbidden_substrings = ['__', 'import', 'eval', 'exec', 'lambda', 'open', 'subprocess', 'os.', 'sys.']
        if any(fs in lowered for fs in forbidden_substrings):
            return False, 'Expression contains forbidden tokens'

        # Extrae palabras (tokens alfabéticos) y valida contra lista permitida
        tokens = re.findall(r'[A-Za-z_]+', expr)
        for t in tokens:
            if t not in allowed_tokens:
                return False, f'Unknown token: {t}'
        return True, ''

    def validate_numeric(value, name: str):
        # Valida que un valor sea numérico o una expresión sencilla (pi, E, + - * /, paréntesis)
        if isinstance(value, (int, float)):
            return True, ''
        if isinstance(value, str):
            v = value.strip()
            try:
                expr = sp.sympify(v)
                _ = float(sp.N(expr))
                return True, ''
            except Exception:
                pass
        return False, f'{name} must be numeric (supports pi, E and basic operations)'

    # Construye LaTeX y explicaciones dinámicas por tipo de función
    def build_graph_explanations(expr_txt: str):
        try:
            expr_sp = sp.sympify(expr_txt)
            func_latex = sp.latex(expr_sp)
            func_text = str(expr_sp)
            # Explicación breve por tipo
            if any(t in func_text for t in ["sin", "cos", "tan", "cot", "csc", "sec"]):
                graph_expl = (
                    "La gráfica representa una superficie ondulada típica de funciones trigonométricas. "
                    "Se observan zonas de crestas y valles periódicos en el plano, donde los valores oscilan entre positivos y negativos."
                )
            elif "exp" in func_text or "e**" in func_text:
                graph_expl = (
                    "La superficie crece de forma exponencial a medida que aumentan x y y. "
                    "Los valores más altos se concentran en la región positiva del plano."
                )
            elif "log" in func_text or "ln" in func_text:
                graph_expl = (
                    "La superficie tiene un crecimiento logarítmico. "
                    "Cerca del origen, los valores son más bajos y se incrementan lentamente conforme x e y aumentan."
                )
            elif "sqrt" in func_text:
                graph_expl = (
                    "La gráfica muestra una superficie tipo cono o cuenco. "
                    "La raíz cuadrada suaviza los cambios y produce una forma radial simétrica alrededor del origen."
                )
            elif "^2" in func_text or "**2" in func_text:
                graph_expl = (
                    "La función cuadrática genera una superficie parabólica. "
                    "Los valores aumentan rápidamente con x e y, creando un cuenco simétrico centrado en el origen."
                )
            else:
                graph_expl = (
                    "La superficie muestra el comportamiento general de la función en el plano xy. "
                    "Los valores más altos se observan donde x e y son mayores."
                )

            # Explicación detallada por tipo
            if "sin" in func_text or "cos" in func_text:
                detailed = (
                    "Las funciones trigonométricas como seno y coseno modelan oscilaciones. "
                    "En el espacio tridimensional, estas generan superficies onduladas. "
                    "Cada cresta y valle representa los puntos donde la función alcanza sus valores máximos y mínimos. "
                    "Estas funciones son fundamentales para describir fenómenos periódicos como ondas o vibraciones."
                )
            elif "exp" in func_text:
                detailed = (
                    "Las funciones exponenciales presentan un crecimiento acelerado. "
                    "En el plano xy, los valores aumentan rápidamente cuando x e y son positivos. "
                    "Estas superficies suelen aparecer en modelos de crecimiento y decaimiento en física y biología."
                )
            elif "sqrt" in func_text:
                detailed = (
                    "La raíz cuadrada produce una superficie suave que crece de forma radial. "
                    "El valor aumenta conforme nos alejamos del origen, pero con pendiente decreciente. "
                    "Este tipo de función se asocia a distancias o magnitudes con simetría circular."
                )
            elif "log" in func_text or "ln" in func_text:
                detailed = (
                    "Las funciones logarítmicas aumentan lentamente y nunca alcanzan valores negativos para entradas positivas. "
                    "Su gráfica muestra un ascenso gradual, común en escalas perceptuales y fenómenos de saturación."
                )
            else:
                detailed = (
                    "La función ingresada genera una superficie general en el espacio tridimensional. "
                    "Su forma depende de las potencias y combinaciones de x e y. "
                    "El estudio de estas superficies permite analizar pendientes, máximos y mínimos locales."
                )
            return func_latex, graph_expl, detailed
        except Exception:
            return None, "La superficie se grafica para z=f(x,y).", "Explora la gráfica: rota y acerca para analizar pendientes y variaciones locales."

    # Helper: envolver LaTeX en modo display para el frontend
    def block_tex(tex: str):
        try:
            if tex is None:
                return None
            s = str(tex)
            # Si ya viene con delimitadores, respetar
            if s.strip().startswith("$$") and s.strip().endswith("$$"):
                return s
            if s.strip().startswith("\\(") and s.strip().endswith("\\)"):
                return s
            return f"$$ {s} $$"
        except Exception:
            return tex

    # Helper: envolver LaTeX en modo inline para el frontend
    def inline_tex(tex: str):
        try:
            if tex is None:
                return None
            s = str(tex)
            t = s.strip()
            if (t.startswith("\\(") and t.endswith("\\)")) or (t.startswith("$$") and t.endswith("$$")):
                return s
            return f"\\({s}\\)"
        except Exception:
            return tex



    # Ruta principal de bienvenida
    @app.route("/", methods=["GET"])
    def home():
        return jsonify({
            "message": "Bienvenido al API de Cálculo Multivariable",
            "endpoints": {
                "/ping": "Verifica el estado del servidor",
                "/info": "Lista de operaciones disponibles"
            }
        })
        
    # Ruta de prueba para verificar que el servidor está activo
    @app.route("/ping", methods=["GET"])
    def ping():
        # Devuelve un estado "ok" en formato JSON
        return jsonify({"status": "ok"})

    # Ruta para informar operaciones disponibles y sus descripciones
    @app.route("/info", methods=["GET"])
    def info():
        # Devuelve un resumen de operaciones y uso esperado
        return jsonify({
            "operations": [
                {"path": "/partials", "method": "POST", "description": "Compute partial derivatives df/dx and df/dy", "body": {"expression": "string"}},
                {"path": "/gradient", "method": "POST", "description": "Compute gradient (fx, fy)", "body": {"expression": "string"}},
                {"path": "/evaluate", "method": "POST", "description": "Evaluate function at (x0, y0)", "body": {"expression": "string", "x0": "number", "y0": "number"}},
                {"path": "/double-integral", "method": "POST", "description": "Compute definite double integral over rectangular limits", "body": {"expression": "string", "x_limits": "[a,b]", "y_limits": "[c,d]"}},
                {"path": "/lagrange", "method": "POST", "description": "Apply Lagrange multipliers with constraint g(x,y)=0", "body": {"expression": "string", "constraint": "string"}},
                {"path": "/optimize", "method": "POST", "description": "Unconstrained optimization for f(x,y)", "body": {"expression": "string"}}
            ]
        })

    # Ruta POST para optimización sin restricciones
    @app.route("/optimize", methods=["POST"])
    def optimize():
        # Comentario: Recibe f(x,y), calcula ∇f=0, Hessiano y clasifica los puntos
        try:
            data = request.get_json()
            if not data or "expression" not in data:
                return jsonify({"error": "Missing field: expression"}), 400
            ok, msg = validate_expression(data["expression"])
            if not ok:
                return jsonify({"error": msg}), 400

            result = calculate_unconstrained_optimization(data["expression"])
            if isinstance(result, dict) and "error" in result:
                return jsonify(result), 400

            # Explicación didáctica y LaTeX
            expr_txt = data["expression"]
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(expr_txt)
            # Pasos estructurados
            edu_steps = [
                {
                    "description": "Calcular el gradiente y resolver ∇f = 0 para puntos críticos.",
                    "latex": block_tex("\\nabla f = 0")
                },
                {
                    "description": "Construir la matriz Hessiana en cada punto crítico.",
                    "latex": block_tex("H = \\begin{pmatrix} f_{xx} & f_{xy} \\ \\ f_{yx} & f_{yy} \\end{pmatrix}")
                },
                {
                    "description": "Evaluar D = f_{xx}f_{yy} - f_{xy}^2 y el signo de f_{xx}.",
                    "latex": block_tex("D = f_{xx}f_{yy} - f_{xy}^2")
                },
                {
                    "description": "Clasificar: mínimo local, máximo local o punto de silla.",
                    "latex": None
                }
            ]
            return jsonify({
                **result,
                "steps": edu_steps,
                "title": "Optimización sin restricciones",
                "summary": "Se encuentran puntos críticos con ∇f=0 y se clasifica cada punto mediante la Hessiana.",
                "func_latex": block_tex(func_latex) if func_latex else None,
                "graph_explanation": graph_expl,
                "graph_explanation_detailed": graph_expl_detailed,
            })
        except Exception as exc:
            return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Ruta POST para calcular derivadas parciales df/dx y df/dy
    @app.route("/partials", methods=["POST"])
    def partials():
        # Lee JSON de la solicitud y valida campos, luego calcula derivadas parciales
        try:
            data = request.get_json()
            if not data or "expression" not in data:
                return jsonify({"error": "Missing field: expression"}), 400
            ok, msg = validate_expression(data["expression"])
            if not ok:
                logger.warning(f"/partials invalid expression: {msg}")
                return jsonify({"error": msg}), 400
            logger.info(f"/partials payload: {data}")

            result = calculate_partials(data["expression"])
            if str(result).lower().startswith("error"):
                return jsonify({"error": result}), 400
            # Pasos y explicación didáctica
            expr_txt = data["expression"]
            try:
                part_x = result.split(',')[0].strip()
                part_y = result.split(',')[-1].strip()
            except Exception:
                part_x, part_y = "df/dx calculado", "df/dy calculado"
            try:
                expr_sp = sp.sympify(expr_txt)
                fx = sp.diff(expr_sp, x)
                fy = sp.diff(expr_sp, y)
                resultado_latex = rf"\frac{{\partial f}}{{\partial x}} = {sp.latex(fx)}, \; \frac{{\partial f}}{{\partial y}} = {sp.latex(fy)}"
                edu_steps = [
                    {
                        "description": "Identificar la función f(x,y).",
                        "latex": block_tex(rf"f(x,y) = {sp.latex(expr_sp)}")
                    },
                    {
                        "description": "Derivar respecto a x.",
                        "latex": block_tex(rf"\frac{{\partial f}}{{\partial x}} = {sp.latex(fx)}")
                    },
                    {
                        "description": "Derivar respecto a y.",
                        "latex": block_tex(rf"\frac{{\partial f}}{{\partial y}} = {sp.latex(fy)}")
                    },
                    {
                        "description": "Cada derivada parcial mide la tasa de cambio en una sola variable.",
                        "latex": None
                    }
                ]
            except Exception:
                resultado_latex = None
                edu_steps = [
                    {
                        "description": f"Identificar la función f(x,y) = {expr_txt}.",
                        "latex": None
                    },
                    {
                        "description": f"Derivar respecto a x: {part_x}.",
                        "latex": None
                    },
                    {
                        "description": f"Derivar respecto a y: {part_y}.",
                        "latex": None
                    },
                    {
                        "description": "Cada derivada parcial mide la tasa de cambio en una sola variable.",
                        "latex": None
                    }
                ]
            explanation = (
                "Las derivadas parciales muestran la sensibilidad de f a cambios en x o en y. "
                "Son la base para construir el gradiente y analizar variaciones locales."
            )
            explanation_detailed = (
                "Las derivadas parciales cuantifican cómo cambia f cuando solo una variable varía, manteniendo la otra fija. "
                "Geométricamente, representan la pendiente al moverse en dirección de los ejes y son ortogonales a las curvas de nivel correspondientes. "
                "A partir de ellas se construye el gradiente y el plano tangente, y se analizan direcciones de máximo crecimiento."
            )
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(expr_txt)
            return jsonify({
                "result": result,
                "resultado_latex": block_tex(resultado_latex) if resultado_latex else None,
                "steps": edu_steps,
                "title": "Derivadas parciales",
                "summary": explanation,
                "explanation": explanation,
                "explanation_detailed": explanation_detailed,
                "func_latex": block_tex(func_latex) if func_latex else None,
                "graph_explanation": graph_expl,
                "graph_explanation_detailed": graph_expl_detailed,
            })
        except Exception as exc:
            logger.exception("/partials unexpected error")
            return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Ruta POST para calcular el gradiente (fx, fy)
    @app.route("/gradient", methods=["POST"])
    def gradient():
        # Lee JSON de la solicitud y valida campos, luego calcula el gradiente
        try:
            data = request.get_json()
            if not data or "expression" not in data:
                return jsonify({"error": "Missing field: expression"}), 400
            ok, msg = validate_expression(data["expression"])
            if not ok:
                logger.warning(f"/gradient invalid expression: {msg}")
                return jsonify({"error": msg}), 400
            logger.info(f"/gradient payload: {data}")

            result = calculate_gradient(data["expression"])
            if str(result).lower().startswith("error"):
                return jsonify({"error": result}), 400
            expr_txt = data["expression"]
            try:
                expr_sp = sp.sympify(expr_txt)
                fx = sp.diff(expr_sp, x)
                fy = sp.diff(expr_sp, y)
                resultado_latex = rf"\nabla f = \left( {sp.latex(fx)}, {sp.latex(fy)} \right)"
                edu_steps = [
                    {
                        "description": "Identificar la función f(x,y).",
                        "latex": block_tex(rf"f(x,y) = {sp.latex(expr_sp)}")
                    },
                    {
                        "description": "Calcular derivadas parciales df/dx y df/dy.",
                        "latex": block_tex(rf"\frac{{\partial f}}{{\partial x}} = {sp.latex(fx)},\; \frac{{\partial f}}{{\partial y}} = {sp.latex(fy)}")
                    },
                    {
                        "description": "Formar el vector gradiente.",
                        "latex": block_tex(rf"\nabla f = \left( {sp.latex(fx)}, {sp.latex(fy)} \right)")
                    },
                    {
                        "description": "El gradiente indica la dirección de mayor crecimiento de la función.",
                        "latex": None
                    }
                ]
            except Exception:
                resultado_latex = None
                edu_steps = [
                    {
                        "description": f"Identificar la función f(x,y) = {expr_txt}.",
                        "latex": None
                    },
                    {
                        "description": "Calcular derivadas parciales df/dx y df/dy.",
                        "latex": None
                    },
                    {
                        "description": f"Formar el vector gradiente ∇f = {result}.",
                        "latex": None
                    },
                    {
                        "description": "El gradiente indica la dirección de mayor crecimiento de la función.",
                        "latex": None
                    }
                ]
            explanation = (
                "El gradiente reúne las derivadas parciales en un vector que apunta donde f aumenta más rápido. "
                "Su norma indica la tasa máxima de incremento local."
            )
            explanation_detailed = (
                "El gradiente ∇f apunta en la dirección de máximo incremento y su magnitud indica la tasa máxima de cambio. "
                "Es perpendicular a las curvas de nivel de f. En optimización, guía métodos de descenso y ascenso; "
                "en física, describe campos como el de temperatura o potencial."
            )
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(expr_txt)
            return jsonify({
                "result": result,
                "resultado_latex": block_tex(resultado_latex) if resultado_latex else None,
                "steps": edu_steps,
                "title": "Gradiente",
                "summary": explanation,
                "explanation": explanation,
                "explanation_detailed": explanation_detailed,
                "func_latex": block_tex(func_latex) if func_latex else None,
                "graph_explanation": graph_expl,
                "graph_explanation_detailed": graph_expl_detailed,
            })
        except Exception as exc:
            logger.exception("/gradient unexpected error")
            return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Ruta POST para evaluar la función en un punto (x0, y0)
    @app.route("/evaluate", methods=["POST"])
    def evaluate():
        # Lee JSON de la solicitud y valida campos, luego evalúa la función en el punto dado
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Missing JSON body"}), 400
            expr_txt = data.get("expression") or data.get("func")
            x0 = data.get("x0")
            y0 = data.get("y0")
            if expr_txt is None or x0 is None or y0 is None:
                return jsonify({"error": "Missing fields: func/expression, x0, y0"}), 400
            ok, msg = validate_expression(expr_txt)
            if not ok:
                logger.warning(f"/evaluate invalid expression: {msg}")
                return jsonify({"error": msg}), 400
            okx, msgx = validate_numeric(x0, 'x0')
            oky, msgy = validate_numeric(y0, 'y0')
            if not okx or not oky:
                logger.warning(f"/evaluate invalid numeric: {msgx or msgy}")
                return jsonify({"error": msgx or msgy}), 400
            logger.info(f"/evaluate payload: {data}")

            result = evaluate_function(expr_txt, x0, y0)
            if str(result).lower().startswith("error"):
                return jsonify({"error": result}), 400
            # expr_txt, x0, y0 ya definidos arriba
            try:
                expr_sp = sp.sympify(expr_txt)
                val = sp.N(sp.sympify(expr_sp.subs({x: sp.sympify(x0), y: sp.sympify(y0)})))
                resultado_latex = f"f({sp.latex(sp.sympify(x0))}, {sp.latex(sp.sympify(y0))}) = {sp.latex(val)}"
                edu_steps = [
                    {
                        "description": "Se identifica la función f(x,y).",
                        "latex": block_tex(rf"f(x,y) = {sp.latex(expr_sp)}")
                    },
                    {
                        "description": "Se sustituyen los valores del punto.",
                        "latex": block_tex(rf"x = {sp.latex(sp.sympify(x0))},\; y = {sp.latex(sp.sympify(y0))}")
                    },
                    {
                        "description": "Se evalúa la expresión para obtener el valor.",
                        "latex": block_tex(sp.latex(val))
                    },
                    {
                        "description": "Este valor corresponde a la altura de la superficie z = f(x,y) en el punto (x0, y0).",
                        "latex": None
                    }
                ]
                value_num = float(val)
            except Exception:
                resultado_latex = None
                value_num = None
                edu_steps = [
                    {
                        "description": f"Se identifica la función f(x,y) = {expr_txt}.",
                        "latex": None
                    },
                    {
                        "description": f"Se sustituyen valores: x = {x0}, y = {y0}.",
                        "latex": None
                    },
                    {
                        "description": f"Se evalúa la expresión y se obtiene: {result}.",
                        "latex": None
                    },
                    {
                        "description": "Este valor corresponde a la altura de la superficie z = f(x,y) en el punto (x0, y0).",
                        "latex": None
                    }
                ]
            # Explicaciones dinámicas basadas en el punto y el valor
            x0_ltx = sp.latex(sp.sympify(x0))
            y0_ltx = sp.latex(sp.sympify(y0))
            expr_ltx = sp.latex(expr_sp) if 'expr_sp' in locals() else expr_txt
            val_num = value_num if value_num is not None else result
            explanation = (
                f"El valor de la función f(x,y) = {expr_ltx} "
                f"evaluada en (x, y) = ({x0_ltx}, {y0_ltx}) es aproximadamente {val_num if isinstance(val_num, float) else val_num}. "
                "Esto representa la altura de la superficie en ese punto."
            )
            explanation_detailed = (
                f"Al sustituir x = {x0_ltx} e y = {y0_ltx} en f(x,y) = {expr_ltx} y evaluar, "
                f"se obtiene f({x0_ltx}, {y0_ltx}) = {sp.latex(sp.sympify(val)) if 'val' in locals() else result}. "
                "Este valor describe la altura (z) de la superficie en esas coordenadas del plano."
            )
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(expr_txt)
            return jsonify({
                "result": result,
                "value": value_num,
                "resultado_latex": block_tex(resultado_latex) if resultado_latex else None,
                "result_latex": block_tex(resultado_latex) if resultado_latex else None,
                "result_numeric": value_num,
                "steps": edu_steps,
                "title": "Evaluación en punto",
                "summary": explanation,
                "explanation": explanation,
                "explanation_detailed": explanation_detailed,
                "func_latex": block_tex(func_latex) if func_latex else None,
                "graph_explanation": graph_expl,
                "graph_explanation_detailed": graph_expl_detailed,
            })
        except Exception as exc:
            logger.exception("/evaluate unexpected error")
            return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Ruta POST para calcular una integral doble (definida o indefinida)
    @app.route("/double-integral", methods=["POST"])
    def double_integral():
        # Lee JSON de la solicitud y valida campos, luego calcula integral definida o indefinida
        try:
            data = request.get_json() or {}
            # Comentario: Se aceptan claves antiguas (expression, x_limits/y_limits) y nuevas (function, xlim/ylim)
            func = data.get("function") or data.get("expression")
            xlim = data.get("xlim") or data.get("x_limits")
            ylim = data.get("ylim") or data.get("y_limits")

            if not func:
                return jsonify({"error": "Missing field: function/expression"}), 400
            ok, msg = validate_expression(func)
            if not ok:
                logger.warning(f"/double-integral invalid expression: {msg}")
                return jsonify({"error": msg}), 400

            # Determinar modo: definido solo si ambos límites son listas/tuplas de 2 elementos válidos
            is_def_x = isinstance(xlim, (list, tuple)) and len(xlim) == 2
            is_def_y = isinstance(ylim, (list, tuple)) and len(ylim) == 2

            if is_def_x and is_def_y:
                ok_ax, msg_ax = validate_numeric(xlim[0], 'xlim[0]')
                ok_bx, msg_bx = validate_numeric(xlim[1], 'xlim[1]')
                ok_ay, msg_ay = validate_numeric(ylim[0], 'ylim[0]')
                ok_by, msg_by = validate_numeric(ylim[1], 'ylim[1]')
                if not all([ok_ax, ok_bx, ok_ay, ok_by]):
                    msg = msg_ax or msg_bx or msg_ay or msg_by
                    logger.warning(f"/double-integral invalid limits: {msg}")
                    return jsonify({"error": msg}), 400
                logger.info(f"/double-integral definite payload: {data}")
                result = calculate_double_integral(func, xlim, ylim)
            else:
                # Comentario: Modo indefinido si los límites no están completos
                logger.info(f"/double-integral indefinite payload: {data}")
                result = calculate_double_integral(func, None, None)

            # Manejo de errores provenientes de math_operations
            if isinstance(result, dict) and result.get("error"):
                return jsonify({"error": result["error"]}), 400
            try:
                if result.get("type") == "definite":
                    integral_tex = sp.latex(sp.sympify(result.get("integral")))
                    expr_tex = sp.latex(sp.sympify(func))
                    ax, bx = xlim
                    ay, by = ylim
                    limits_tex = f"\\int_{sp.latex(sp.sympify(ax))}^{sp.latex(sp.sympify(bx))} \\int_{sp.latex(sp.sympify(ay))}^{sp.latex(sp.sympify(by))} {expr_tex} \\, dy \\, dx"
                    result["integral_latex"] = block_tex(integral_tex)
                    result["definite_symbolic_latex"] = block_tex(limits_tex)
                    result["expression_latex"] = block_tex(expr_tex)
                    # Pasos y explicación en LaTeX para modo definido (estructurados)
                    edu_steps = [
                        {
                            "description": "Se identifica la función f(x,y).",
                            "latex": block_tex(rf"f(x,y) = {expr_tex}")
                        },
                        {
                            "description": "Integrar respecto a y en el intervalo indicado.",
                            "latex": block_tex(rf"\\int_{{{sp.latex(sp.sympify(ay))}}}^{{{sp.latex(sp.sympify(by))}}} {expr_tex} \\, dy")
                        },
                        {
                            "description": "Integrar el resultado respecto a x en el intervalo indicado.",
                            "latex": block_tex(rf"\\int_{{{sp.latex(sp.sympify(ax))}}}^{{{sp.latex(sp.sympify(bx))}}} \\left( \\int_{{{sp.latex(sp.sympify(ay))}}}^{{{sp.latex(sp.sympify(by))}}} {expr_tex} \\, dy \\right) \\, dx")
                        },
                        {
                            "description": "Simplificar y, si aplica, evaluar numéricamente.",
                            "latex": block_tex(integral_tex)
                        }
                    ]
                    result["steps"] = edu_steps
                    result["title"] = "Integral doble definida"
                    result["summary"] = "La integral doble definida calcula el volumen bajo z = f(x,y) sobre la región dada, integrando primero en y y luego en x."
                    result["explanation"] = (
                        "La integral doble definida calcula el volumen bajo z = f(x,y) sobre el rectángulo dado; primero en y y luego en x."
                    )
                    result["explanation_detailed"] = (
                        "En una integral doble definida, se evalúa la integral interna (por ejemplo, respecto a y), obteniendo una función de x. "
                        "Luego se integra esa función respecto a x y se aplican los límites. El resultado representa el volumen bajo la superficie z=f(x,y) en la región rectangular especificada."
                    )
                elif result.get("type") == "indefinite":
                    # Construir LaTeX mostrando explícitamente el símbolo de integral y la igualdad
                    expr_tex = sp.latex(sp.sympify(func))
                    inner_tex = sp.latex(sp.sympify(result.get("inner_integral")))
                    outer_tex = sp.latex(sp.sympify(result.get("double_integral")))

                    inner_with_symbol = rf"\\int {expr_tex} \, dy = {inner_tex}"
                    outer_with_symbol = rf"\\int \\left({inner_tex}\\right) \, dx = {outer_tex}"
                    double_symbolic = rf"\\iint {expr_tex} \, dy \, dx = {outer_tex}"

                    result["expression_latex"] = block_tex(expr_tex)
                    result["inner_integral_latex"] = block_tex(inner_with_symbol)
                    result["double_integral_latex"] = block_tex(outer_with_symbol)
                    result["double_integral_symbolic_latex"] = block_tex(double_symbolic)

                    # Pasos y explicación con notación LaTeX para modo indefinido (estructurados)
                    edu_steps = [
                        {
                            "description": "Se identifica la función f(x,y).",
                            "latex": block_tex(rf"f(x,y) = {expr_tex}")
                        },
                        {
                            "description": "Antiderivada respecto a y.",
                            "latex": block_tex(inner_with_symbol)
                        },
                        {
                            "description": "Antiderivada del resultado respecto a x.",
                            "latex": block_tex(outer_with_symbol)
                        },
                        {
                            "description": "Sin límites: el resultado corresponde a la familia de antiderivadas.",
                            "latex": None
                        }
                    ]
                    result["steps"] = edu_steps
                    result["title"] = "Integral doble indefinida"
                    result["summary"] = "La integral doble indefinida representa antiderivadas iteradas: primero respecto a y y luego respecto a x."
                    result["explanation"] = (
                        "La integral doble indefinida representa una antiderivada iterada de f(x,y): primero respecto a y, luego respecto a x."
                    )
                    result["explanation_detailed"] = (
                        "Al no aplicarse límites, se obtiene una familia de antiderivadas. Se integra primero respecto a una variable manteniendo la otra constante, "
                        "y después respecto a la segunda. Este proceso describe el patrón de acumulación de f en el plano y permite interpretar el crecimiento de la función."
                    )
            except Exception:
                pass
            # Añadir LaTeX y explicaciones de la función base para apoyar el frontend
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(func)
            result["func_latex"] = block_tex(func_latex) if func_latex else None
            result["graph_explanation"] = graph_expl
            result["graph_explanation_detailed"] = graph_expl_detailed
            return jsonify(result)
        except Exception as exc:
            logger.exception("/double-integral unexpected error")
            return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Ruta POST para análisis de dominio, rango y límite
    @app.route("/analyze_domain", methods=["POST"])
    def analyze_domain():
        try:
            data = request.get_json() or {}
            expr_txt = data.get("expression", "")
            ok, msg = validate_expression(expr_txt)
            if not ok:
                logger.warning(f"/analyze_domain invalid expression: {msg}")
                return jsonify({"error": msg}), 400

            # Opcional: punto para límite
            x0 = data.get("x0", None)
            y0 = data.get("y0", None)
            if x0 is not None:
                okx, msgx = validate_numeric(x0, "x0")
                if not okx:
                    return jsonify({"error": msgx}), 400
            if y0 is not None:
                oky, msgy = validate_numeric(y0, "y0")
                if not oky:
                    return jsonify({"error": msgy}), 400

            f = sp.sympify(expr_txt)

            # Detectar condiciones del dominio simbólico de forma básica
            conditions = []
            try:
                # Denominadores distintos de cero
                denom = sp.denom(sp.together(f))
                if denom != 1:
                    conditions.append(f"denominador \( {sp.latex(denom)} \) ≠ 0")
                # Argumentos de log positivos
                for node in f.atoms(sp.Function):
                    if getattr(node, 'func', None) == sp.log:
                        arg = node.args[0]
                        conditions.append(f"\( {sp.latex(arg)} > 0 \)")
                    if getattr(node, 'func', None) == sp.sqrt:
                        arg = node.args[0]
                        conditions.append(f"\( {sp.latex(arg)} \ge 0 \)")
            except Exception:
                pass
            domain_conditions = ", ".join(conditions) if conditions else "Sin restricciones adicionales (posible continuidad en \(\mathbb{R}^2\))."

            # Estimar rango con cuadrícula numérica sobre [-10, 10]
            minv, maxv = None, None
            try:
                fx = sp.lambdify((x, y), f, modules=["numpy"])
                grid = np.linspace(-10, 10, 60)
                X, Y = np.meshgrid(grid, grid)
                Z = fx(X, Y)
                Z = np.array(Z, dtype=float)
                Z[~np.isfinite(Z)] = np.nan
                if np.isfinite(Z).any():
                    minv = float(np.nanmin(Z))
                    maxv = float(np.nanmax(Z))
            except Exception:
                pass

            # Calcular límite (iterado) si se proporciona punto
            limit_value = None
            try:
                if x0 is not None and y0 is not None:
                    x0s = float(sp.N(sp.sympify(x0)))
                    y0s = float(sp.N(sp.sympify(y0)))
                    Lxy = sp.limit(sp.limit(f, x, x0s), y, y0s)
                    Lyx = sp.limit(sp.limit(f, y, y0s), x, x0s)
                    if Lxy == sp.oo or Lyx == sp.oo:
                        limit_value = "infinity"
                    elif Lxy == -sp.oo or Lyx == -sp.oo:
                        limit_value = "-infinity"
                    elif (Lxy is sp.NaN) or (Lyx is sp.NaN):
                        limit_value = "undefined"
                    elif sp.simplify(Lxy - Lyx) == 0:
                        try:
                            limit_value = str(float(sp.N(Lxy)))
                        except Exception:
                            limit_value = sp.latex(Lxy)
                    else:
                        limit_value = "undefined"
            except Exception:
                # Fallback: evaluar cerca del punto si es posible
                try:
                    if x0 is not None and y0 is not None:
                        x0s = float(sp.N(sp.sympify(x0)))
                        y0s = float(sp.N(sp.sympify(y0)))
                        fx = sp.lambdify((x, y), f, modules=["numpy"])
                        eps = 1e-3
                        val = fx(x0s + eps, y0s + eps)
                        if np.isfinite(val):
                            limit_value = str(float(val))
                        else:
                            limit_value = "undefined"
                except Exception:
                    limit_value = "undefined"

            # Explicaciones para frontend
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(expr_txt)
            explanation = "Se analizan condiciones de existencia (dominio), se estima el rango y se evalúa el límite si se indica un punto."
            # Pasos estructurados con LaTeX
            func_tex = sp.latex(f)
            limit_latex = None
            if (x0 is not None) and (y0 is not None):
                limit_latex = block_tex(rf"\lim_{{(x,y)\to ({sp.latex(sp.sympify(x0))}, {sp.latex(sp.sympify(y0))})}} f(x,y)")
            edu_steps = [
                {
                    "description": "Se identifica la función f(x,y).",
                    "latex": block_tex(rf"f(x,y) = {func_tex}")
                },
                {
                    "description": "Se analizan las condiciones del dominio (divisiones por cero, log > 0, sqrt ≥ 0).",
                    "latex": None
                },
                {
                    "description": "Se estima el rango evaluando la función sobre una cuadrícula.",
                    "latex": None
                },
                {
                    "description": "Se calcula el límite en (x0,y0) si se proporcionó el punto.",
                    "latex": limit_latex
                },
            ]

            return jsonify({
                "domain_conditions": domain_conditions,
                "range_estimated": [minv, maxv] if (minv is not None and maxv is not None) else None,
                "limit_value": limit_value,
                "func_latex": block_tex(func_latex) if func_latex else None,
                "graph_explanation": graph_expl,
                "graph_explanation_detailed": graph_expl_detailed,
                "steps": edu_steps,
                "title": "Análisis de dominio y límite",
                "summary": explanation,
                "explanation": explanation,
            })
        except Exception as exc:
            logger.exception("/analyze_domain unexpected error")
            return jsonify({"error": f"Unexpected error: {exc}"}), 500

    # Ruta POST para aplicar el método de Lagrange con restricción g(x,y)=0
    @app.route("/lagrange", methods=["POST"])
    def lagrange():
        # Lee JSON de la solicitud y valida campos, luego aplica multiplicadores de Lagrange
        try:
            data = request.get_json()
            required = ("expression", "constraint")
            if not data or any(k not in data for k in required):
                return jsonify({"error": "Missing fields: expression, constraint"}), 400
            ok, msg = validate_expression(data["expression"])
            if not ok:
                logger.warning(f"/lagrange invalid expression: {msg}")
                return jsonify({"error": msg}), 400
            okc, msgc = validate_expression(data["constraint"])
            if not okc:
                logger.warning(f"/lagrange invalid constraint: {msgc}")
                return jsonify({"error": msgc}), 400
            logger.info(f"/lagrange payload: {data}")

            # Normaliza la restricción: permite formato "x+y=1" convirtiéndolo a g(x,y)=0
            g_txt_in = data["constraint"]
            try:
                if "=" in g_txt_in:
                    rel = sp.sympify(g_txt_in)
                    # Si es una igualdad, convertir lhs - rhs
                    if isinstance(rel, sp.Equality):
                        g_txt_in = str(sp.simplify(rel.lhs - rel.rhs))
            except Exception:
                # Si falla la normalización, usar la cadena original
                g_txt_in = data["constraint"]

            result = lagrange_method(data["expression"], g_txt_in)
            if str(result).lower().startswith("error"):
                return jsonify({"error": result}), 400
            expr_txt = data["expression"]
            g_txt = g_txt_in
            try:
                f = sp.sympify(expr_txt)
                g = sp.sympify(g_txt)
                lam = sp.symbols('lambda')
                L = f + lam * g
                eq1 = sp.Eq(sp.diff(L, x), 0)
                eq2 = sp.Eq(sp.diff(L, y), 0)
                eq3 = sp.Eq(g, 0)
                sols = sp.solve((eq1, eq2, eq3), (x, y, lam), dict=True)
                # Comentario: Lista estructurada de puntos críticos con valor de f(x,y)
                points = []
                if sols:
                    tex_points = []
                    for s in sols:
                        xv = s.get(x)
                        yv = s.get(y)
                        lv = s.get(lam)
                        try:
                            fval = sp.N(f.subs({x: xv, y: yv}))
                        except Exception:
                            fval = None
                        try:
                            x_num = float(sp.N(xv)) if xv is not None else None
                        except Exception:
                            x_num = None
                        try:
                            y_num = float(sp.N(yv)) if yv is not None else None
                        except Exception:
                            y_num = None
                        try:
                            l_num = float(sp.N(lv)) if lv is not None else None
                        except Exception:
                            l_num = None
                        try:
                            f_num = float(sp.N(fval)) if fval is not None else None
                        except Exception:
                            f_num = None
                        points.append({"x": x_num, "y": y_num, "lambda": l_num, "f": f_num})
                        tex_points.append(f"\\left(x={sp.latex(xv)},\\; y={sp.latex(yv)},\\; \\lambda={sp.latex(lv)}\\right)")
                    resultado_latex = "[" + ", ".join(tex_points) + "]"
                else:
                    resultado_latex = None
                    points = []
                edu_steps = [
                    {
                        "description": "Se forma la función de Lagrange:",
                        "latex": block_tex(f"L(x,y,\\lambda)={sp.latex(L)}")
                    },
                    {
                        "description": "Se calculan las derivadas parciales e igualan a cero:",
                        "latex": block_tex(
                            f"\\frac{{\\partial L}}{{\\partial x}}={sp.latex(sp.diff(L, x))}=0, \\quad "
                            f"\\frac{{\\partial L}}{{\\partial y}}={sp.latex(sp.diff(L, y))}=0, \\quad "
                            f"\\frac{{\\partial L}}{{\\partial \\lambda}}={sp.latex(sp.diff(L, lam))}=0"
                        )
                    },
                    {
                        "description": "Solución del sistema:",
                        "latex": block_tex(resultado_latex or str(result))
                    }
                ]
            except Exception:
                resultado_latex = None
                points = []
                edu_steps = [
                    {
                        "description": "Se forma la función de Lagrange:",
                        "latex": block_tex(f"L(x,y,\\lambda)={expr_txt} + \\lambda\\,({g_txt})")
                    },
                    {
                        "description": "Se calculan las derivadas parciales e igualan a cero:",
                        "latex": block_tex("\\frac{\\partial L}{\\partial x}=0, \\quad \\frac{\\partial L}{\\partial y}=0, \\quad \\frac{\\partial L}{\\partial \\lambda}=0")
                    },
                    {
                        "description": "Solución del sistema:",
                        "latex": block_tex(str(result))
                    }
                ]
            explanation = (
                "Con multiplicadores de Lagrange se encuentran máximos o mínimos de f bajo una restricción. "
                "Los puntos hallados satisfacen simultáneamente las condiciones del Lagrangiano y g = 0."
            )
            explanation_detailed = (
                "El método introduce una variable λ para imponer la restricción g(x,y)=0. Se construye L=f+λg y se resuelven ∂L/∂x=0, ∂L/∂y=0 junto con g=0. "
                "Los puntos obtenidos son candidatos a extremos condicionados; para clasificarlos se evalúa f y se analizan condiciones adicionales según el problema."
            )
            func_latex, graph_expl, graph_expl_detailed = build_graph_explanations(expr_txt)
            summary_tex = f"$$f(x,y)={sp.latex(sp.sympify(expr_txt))}$$ sujeto a $$g(x,y)={sp.latex(sp.sympify(g_txt))}=0$$"
            return jsonify({
                "result": result,
                "resultado_latex": block_tex(resultado_latex) if resultado_latex else None,
                "critical_points": points,
                "steps": edu_steps,
                "explanation": explanation,
                "explanation_detailed": explanation_detailed,
                "func_latex": block_tex(func_latex) if func_latex else None,
                "graph_explanation": graph_expl,
                "graph_explanation_detailed": graph_expl_detailed,
                "title": "Optimización con Restricción (Método de Lagrange)",
                "summary": summary_tex
            })
        except Exception as exc:
            logger.exception("/lagrange unexpected error")
            return jsonify({"error": f"Unexpected error: {exc}"}), 500
    
    return app


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
