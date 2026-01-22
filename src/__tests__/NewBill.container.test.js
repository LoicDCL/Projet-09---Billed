import { fireEvent, screen } from "@testing-library/dom"
import NewBillUI from "../views/NewBillUI.js"
import NewBill from "../containers/NewBill.js"
import { ROUTES_PATH } from "../constants/routes.js"

// Helper pour attendre la résolution des Promises (then / catch)
const flushPromises = () => new Promise(setImmediate)

describe("Étant donné que je suis connecté en tant qu’employé", () => {
    beforeEach(() => {
        // GIVEN : la page NewBill est affichée
        document.body.innerHTML = NewBillUI()

        // GIVEN : un utilisateur employé est présent dans le localStorage
        Object.defineProperty(window, "localStorage", {
            value: {
                getItem: jest.fn(() =>
                    JSON.stringify({ type: "Employee", email: "a@a" })
                ),
                setItem: jest.fn(),
                removeItem: jest.fn()
            },
            writable: true
        })

        // GIVEN : les fonctions globales sont mockées
        jest.spyOn(console, "log").mockImplementation(() => {})
        jest.spyOn(console, "error").mockImplementation(() => {})
        window.alert = jest.fn()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe("Gestion de l’upload de fichier", () => {
        test("Quand le fichier est invalide, alors une alerte est affichée et aucun envoi n’est effectué", async () => {
            // GIVEN : un container NewBill avec un store mocké
            const onNavigate = jest.fn()
            const store = {
                bills: () => ({
                    create: jest.fn(() =>
                        Promise.resolve({ fileUrl: "x", key: "y" })
                    )
                })
            }

            const newBill = new NewBill({
                document,
                onNavigate,
                store,
                localStorage: window.localStorage
            })

            // GIVEN : un fichier PDF (type non autorisé)
            const file = new File(["dummy"], "test.pdf", {
                type: "application/pdf"
            })
            const inputFile = screen.getByTestId("file")

            Object.defineProperty(inputFile, "files", {
                value: [file],
                writable: false
            })

            // WHEN : l’utilisateur sélectionne le fichier
            fireEvent.change(inputFile)

            // THEN : une alerte est affichée
            expect(window.alert).toHaveBeenCalled()

            // THEN : le champ fichier est vidé
            expect(inputFile.value).toBe("")

            // THEN : aucun POST n’est effectué
            expect(store.bills().create).not.toHaveBeenCalled()

            // THEN : aucune donnée fichier n’est stockée
            expect(newBill.fileUrl).toBeNull()
            expect(newBill.fileName).toBeNull()
        })

        test("Quand le fichier est valide, alors le fichier est envoyé à l’API (POST create)", async () => {
            // GIVEN : un store mocké avec create()
            const onNavigate = jest.fn()
            const createMock = jest.fn(() =>
                Promise.resolve({
                    fileUrl: "https://localhost/file.png",
                    key: "abc123"
                })
            )

            const store = {
                bills: () => ({
                    create: createMock
                })
            }

            const newBill = new NewBill({
                document,
                onNavigate,
                store,
                localStorage: window.localStorage
            })

            // GIVEN : un fichier image valide
            const file = new File(["dummy"], "justificatif.png", {
                type: "image/png"
            })
            const inputFile = screen.getByTestId("file")

            Object.defineProperty(inputFile, "files", {
                value: [file],
                writable: false
            })

            // WHEN : l’utilisateur sélectionne le fichier
            fireEvent.change(inputFile)
            await flushPromises()

            // THEN : l’API est appelée (POST create)
            expect(createMock).toHaveBeenCalled()

            // THEN : les données du fichier sont stockées
            expect(newBill.billId).toBe("abc123")
            expect(newBill.fileUrl).toBe("https://localhost/file.png")
            expect(newBill.fileName).toBe("justificatif.png")
        })
    })

    describe("Création d’une note de frais — TEST D’INTÉGRATION POST NEW BILL", () => {
        test("Quand je soumets le formulaire, alors la note de frais est envoyée à l’API et je suis redirigé", async () => {

            // GIVEN : un store mocké avec create() et update()
            const onNavigate = jest.fn()

            const createMock = jest.fn(() =>
                Promise.resolve({
                    fileUrl: "https://localhost/receipt.jpg",
                    key: "billKey42"
                })
            )

            const updateMock = jest.fn(() => Promise.resolve())

            const store = {
                bills: () => ({
                    create: createMock,
                    update: updateMock
                })
            }

            new NewBill({
                document,
                onNavigate,
                store,
                localStorage: window.localStorage
            })

            // GIVEN : un fichier valide est uploadé
            const file = new File(["dummy"], "receipt.jpg", {
                type: "image/jpeg"
            })
            const inputFile = screen.getByTestId("file")

            Object.defineProperty(inputFile, "files", {
                value: [file],
                writable: false
            })

            fireEvent.change(inputFile)
            await flushPromises()

            // GIVEN : le formulaire est rempli
            fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } })
            fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Taxi" } })
            fireEvent.change(screen.getByTestId("amount"), { target: { value: "42" } })
            fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2023-12-01" } })
            fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } })
            fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } })
            fireEvent.change(screen.getByTestId("commentary"), { target: { value: "note" } })

            // WHEN : le formulaire est soumis
            fireEvent.submit(screen.getByTestId("form-new-bill"))
            await flushPromises()

            // THEN : la note de frais est envoyée à l’API (POST update)
            expect(updateMock).toHaveBeenCalled()

            // THEN : les données envoyées sont correctes
            const updateArgs = updateMock.mock.calls[0][0]
            const payload = JSON.parse(updateArgs.data)

            expect(updateArgs.selector).toBe("billKey42")
            expect(payload.email).toBe("a@a")
            expect(payload.type).toBe("Transports")
            expect(payload.name).toBe("Taxi")
            expect(payload.amount).toBe(42)
            expect(payload.date).toBe("2023-12-01")
            expect(payload.fileUrl).toBe("https://localhost/receipt.jpg")
            expect(payload.fileName).toBe("receipt.jpg")
            expect(payload.status).toBe("pending")

            // THEN : l’utilisateur est redirigé vers la page Bills
            expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH["Bills"])
        })
    })

    describe("Cas particulier : absence de store", () => {

        test("Quand le store est null, alors la navigation vers Bills fonctionne quand même", async () => {
            // GIVEN : un container NewBill sans store
            const onNavigate = jest.fn()

            new NewBill({
                document,
                onNavigate,
                store: null,
                localStorage: window.localStorage
            })

            // GIVEN : le formulaire est rempli
            fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } })
            fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Taxi" } })
            fireEvent.change(screen.getByTestId("amount"), { target: { value: "42" } })
            fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2023-12-01" } })
            fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } })
            fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } })
            fireEvent.change(screen.getByTestId("commentary"), { target: { value: "note" } })

            // WHEN : le formulaire est soumis
            fireEvent.submit(screen.getByTestId("form-new-bill"))

            // THEN : la navigation vers Bills est effectuée
            expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH["Bills"])
        })
    })
})
